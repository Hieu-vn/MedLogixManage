# ============================================================
# NETWORK SPEED TEST & ANOMALY DETECTION SCRIPT
# Date: 2026-03-08
# ============================================================

$OutputFile = "c:\MedLogixManage\network_report.txt"

function Write-Report {
    param([string]$Text)
    Write-Host $Text
    Add-Content -Path $OutputFile -Value $Text
}

# Clear previous report
if (Test-Path $OutputFile) { Remove-Item $OutputFile -Force }

Write-Report "============================================================"
Write-Report "  NETWORK DIAGNOSTIC REPORT - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Report "============================================================"
Write-Report ""

# ---- 1. Network Adapter Info ----
Write-Report "=== 1. NETWORK ADAPTER STATUS ==="
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
foreach ($adapter in $adapters) {
    Write-Report "  Adapter: $($adapter.Name)"
    Write-Report "  Interface: $($adapter.InterfaceDescription)"
    Write-Report "  Status: $($adapter.Status)"
    Write-Report "  Link Speed: $($adapter.LinkSpeed)"
    Write-Report "  MAC: $($adapter.MacAddress)"
    Write-Report ""
}

# ---- 2. IP Configuration ----
Write-Report "=== 2. IP CONFIGURATION ==="
$ipConfigs = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }
foreach ($cfg in $ipConfigs) {
    Write-Report "  Interface: $($cfg.InterfaceAlias)"
    Write-Report "  IPv4 Address: $($cfg.IPv4Address.IPAddress)"
    Write-Report "  Subnet Prefix: $($cfg.IPv4Address.PrefixLength)"
    Write-Report "  Default Gateway: $($cfg.IPv4DefaultGateway.NextHop)"
    $dns = $cfg.DNSServer | Where-Object { $_.AddressFamily -eq 2 }
    Write-Report "  DNS Servers: $($dns.ServerAddresses -join ', ')"
    Write-Report ""
}

# ---- 3. WiFi Signal & Connection ----
Write-Report "=== 3. WIFI CONNECTION DETAILS ==="
try {
    $wifiInfo = netsh wlan show interfaces
    $wifiInfo | ForEach-Object { Write-Report "  $_" }
}
catch {
    Write-Report "  Could not retrieve WiFi info."
}
Write-Report ""

# ---- 4. Speed Test via Download ----
Write-Report "=== 4. SPEED TEST (Download) ==="
$testUrls = @(
    @{ Name = "Cloudflare (10MB)"; Url = "https://speed.cloudflare.com/__down?bytes=10000000" },
    @{ Name = "Google (gstatic)"; Url = "https://www.gstatic.com/generate_204" }
)

foreach ($test in $testUrls) {
    Write-Report "  Testing: $($test.Name)..."
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $test.Url -UseBasicParsing -TimeoutSec 30
        $sw.Stop()
        $bytes = $response.Content.Length
        $seconds = $sw.Elapsed.TotalSeconds
        if ($bytes -gt 0) {
            $mbps = [math]::Round(($bytes * 8) / ($seconds * 1000000), 2)
            Write-Report "    Downloaded: $([math]::Round($bytes/1024/1024, 2)) MB"
            Write-Report "    Time: $([math]::Round($seconds, 2))s"
            Write-Report "    Speed: $mbps Mbps"
        }
        else {
            Write-Report "    Response time: $([math]::Round($seconds * 1000, 0))ms (connectivity check)"
        }
    }
    catch {
        Write-Report "    FAILED: $($_.Exception.Message)"
    }
    Write-Report ""
}

# ---- 5. Latency Test (Ping) ----
Write-Report "=== 5. LATENCY TEST (Ping) ==="
$pingTargets = @(
    @{ Name = "Default Gateway"; Target = "" },
    @{ Name = "Google DNS"; Target = "8.8.8.8" },
    @{ Name = "Cloudflare DNS"; Target = "1.1.1.1" },
    @{ Name = "Google.com"; Target = "google.com" },
    @{ Name = "Facebook.com"; Target = "facebook.com" }
)

# Get gateway for first target
$gateway = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop
if ($gateway) { $pingTargets[0].Target = $gateway }

foreach ($pt in $pingTargets) {
    if ([string]::IsNullOrEmpty($pt.Target)) { continue }
    Write-Report "  Pinging $($pt.Name) ($($pt.Target)) - 10 packets..."
    try {
        $results = Test-Connection -ComputerName $pt.Target -Count 10 -ErrorAction Stop
        $latencies = $results | ForEach-Object { $_.ResponseTime }
        $avg = [math]::Round(($latencies | Measure-Object -Average).Average, 1)
        $min = ($latencies | Measure-Object -Minimum).Minimum
        $max = ($latencies | Measure-Object -Maximum).Maximum
        $jitter = [math]::Round(($latencies | ForEach-Object { [math]::Abs($_ - $avg) } | Measure-Object -Average).Average, 1)
        $loss = [math]::Round((10 - $results.Count) / 10 * 100, 0)
        Write-Report "    Avg: ${avg}ms | Min: ${min}ms | Max: ${max}ms | Jitter: ${jitter}ms | Loss: ${loss}%"
        
        # Anomaly detection
        if ($avg -gt 100) { Write-Report "    [WARNING] High latency detected!" }
        if ($jitter -gt 30) { Write-Report "    [WARNING] High jitter - unstable connection!" }
        if ($loss -gt 0) { Write-Report "    [WARNING] Packet loss detected!" }
        if ($max -gt ($avg * 3) -and $max -gt 50) { Write-Report "    [WARNING] Latency spikes detected (max >> avg)!" }
    }
    catch {
        Write-Report "    FAILED: $($_.Exception.Message)"
        Write-Report "    [CRITICAL] Cannot reach $($pt.Name)!"
    }
    Write-Report ""
}

# ---- 6. DNS Resolution Speed ----
Write-Report "=== 6. DNS RESOLUTION SPEED ==="
$dnsTargets = @("google.com", "facebook.com", "github.com", "youtube.com", "vnexpress.net")
foreach ($domain in $dnsTargets) {
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $result = Resolve-DnsName $domain -Type A -ErrorAction Stop
        $sw.Stop()
        $ms = [math]::Round($sw.Elapsed.TotalMilliseconds, 0)
        $ip = ($result | Where-Object { $_.Type -eq 'A' } | Select-Object -First 1).IPAddress
        Write-Report "  $domain -> $ip (${ms}ms)"
        if ($ms -gt 500) { Write-Report "    [WARNING] Slow DNS resolution!" }
    }
    catch {
        Write-Report "  $domain -> FAILED"
        Write-Report "    [CRITICAL] DNS resolution failure!"
    }
}
Write-Report ""

# ---- 7. Traceroute to Google ----
Write-Report "=== 7. TRACEROUTE TO GOOGLE (8.8.8.8) ==="
Write-Report "  (First 15 hops)"
try {
    $trace = Test-NetConnection -ComputerName 8.8.8.8 -TraceRoute -WarningAction SilentlyContinue
    Write-Report "  Remote Address: $($trace.RemoteAddress)"
    Write-Report "  Ping Succeeded: $($trace.PingSucceeded)"
    Write-Report "  Round-trip time: $($trace.PingReplyDetails.RoundtripTime)ms"
    $hopNum = 1
    foreach ($hop in $trace.TraceRoute) {
        Write-Report "    Hop $hopNum : $hop"
        $hopNum++
    }
}
catch {
    Write-Report "  Traceroute failed: $($_.Exception.Message)"
}
Write-Report ""

# ---- 8. Active Connections Analysis ----
Write-Report "=== 8. ACTIVE CONNECTIONS ANALYSIS ==="
$connections = Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue
$totalConn = $connections.Count
Write-Report "  Total established connections: $totalConn"
if ($totalConn -gt 200) { Write-Report "  [WARNING] Very high number of connections!" }

$byProcess = $connections | Group-Object OwningProcess | Sort-Object Count -Descending | Select-Object -First 10
Write-Report "  Top processes by connection count:"
foreach ($proc in $byProcess) {
    $procName = (Get-Process -Id $proc.Name -ErrorAction SilentlyContinue).ProcessName
    if (-not $procName) { $procName = "PID:$($proc.Name)" }
    Write-Report "    $procName : $($proc.Count) connections"
    if ($proc.Count -gt 50) { Write-Report "      [WARNING] Unusually high connection count for this process!" }
}
Write-Report ""

# ---- 9. Listening Ports ----
Write-Report "=== 9. LISTENING PORTS ==="
$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Sort-Object LocalPort
Write-Report "  Total listening ports: $($listeners.Count)"
$suspiciousPorts = $listeners | Where-Object { $_.LocalPort -notin @(80, 443, 135, 139, 445, 3389, 5040, 5357, 7680, 49664, 49665, 49666, 49667, 49668, 49669, 49670) -and $_.LocalPort -lt 10000 }
if ($suspiciousPorts) {
    Write-Report "  Potentially unusual listening ports:"
    foreach ($sp in $suspiciousPorts) {
        $pName = (Get-Process -Id $sp.OwningProcess -ErrorAction SilentlyContinue).ProcessName
        Write-Report "    Port $($sp.LocalPort) - Process: $pName (PID: $($sp.OwningProcess))"
    }
}
Write-Report ""

# ---- 10. Network Interface Statistics ----
Write-Report "=== 10. NETWORK INTERFACE STATISTICS ==="
$stats = Get-NetAdapterStatistics -ErrorAction SilentlyContinue
foreach ($s in $stats) {
    $adapter = Get-NetAdapter -Name $s.Name -ErrorAction SilentlyContinue
    if ($adapter.Status -eq 'Up') {
        Write-Report "  Adapter: $($s.Name)"
        Write-Report "    Bytes Sent: $([math]::Round($s.SentBytes/1MB, 2)) MB"
        Write-Report "    Bytes Received: $([math]::Round($s.ReceivedBytes/1MB, 2)) MB"
        Write-Report "    Packets Sent: $($s.SentUnicastPackets)"
        Write-Report "    Packets Received: $($s.ReceivedUnicastPackets)"
        $errorRate = 0
        if ($s.ReceivedUnicastPackets -gt 0) {
            $inErrors = if ($s.PSObject.Properties['InboundDiscardedPackets']) { $s.InboundDiscardedPackets } else { 0 }
            $errorRate = [math]::Round($inErrors / $s.ReceivedUnicastPackets * 100, 4)
        }
        if ($errorRate -gt 1) { Write-Report "    [WARNING] High packet discard rate: ${errorRate}%!" }
        Write-Report ""
    }
}

# ---- 11. ARP Table Check ----
Write-Report "=== 11. ARP TABLE (Checking for duplicates) ==="
$arp = Get-NetNeighbor -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Permanent' -and $_.LinkLayerAddress -ne '' -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' }
$dupMAC = $arp | Group-Object LinkLayerAddress | Where-Object { $_.Count -gt 1 -and $_.Name -ne 'FF-FF-FF-FF-FF-FF' }
if ($dupMAC) {
    Write-Report "  [WARNING] Duplicate MAC addresses found (possible ARP spoofing):"
    foreach ($dup in $dupMAC) {
        Write-Report "    MAC: $($dup.Name) used by IPs: $(($dup.Group | ForEach-Object { $_.IPAddress }) -join ', ')"
    }
}
else {
    Write-Report "  No ARP anomalies detected."
}
Write-Report ""

# ---- 12. Firewall Status ----
Write-Report "=== 12. FIREWALL STATUS ==="
$fwProfiles = Get-NetFirewallProfile -ErrorAction SilentlyContinue
foreach ($fw in $fwProfiles) {
    $status = if ($fw.Enabled) { "ENABLED" } else { "[WARNING] DISABLED" }
    Write-Report "  $($fw.Name) Profile: $status"
}
Write-Report ""

# ---- SUMMARY & ANOMALY REPORT ----
Write-Report "============================================================"
Write-Report "  ANOMALY SUMMARY"
Write-Report "============================================================"
$reportContent = Get-Content $OutputFile -Raw
$warnings = ([regex]::Matches($reportContent, '\[WARNING\]')).Count
$criticals = ([regex]::Matches($reportContent, '\[CRITICAL\]')).Count
Write-Report "  Total Warnings: $warnings"
Write-Report "  Total Critical Issues: $criticals"
if ($warnings -eq 0 -and $criticals -eq 0) {
    Write-Report "  Status: ALL CLEAR - No anomalies detected!"
}
elseif ($criticals -gt 0) {
    Write-Report "  Status: CRITICAL ISSUES FOUND - Immediate attention required!"
}
else {
    Write-Report "  Status: WARNINGS FOUND - Review recommended."
}
Write-Report ""
Write-Report "  Report saved to: $OutputFile"
Write-Report "============================================================"
