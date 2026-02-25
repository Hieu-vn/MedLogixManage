Add-Type -AssemblyName System.IO

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$outFile = "c:\MedLogixManage\sheet1_full.txt"
$sw = New-Object System.IO.StreamWriter($outFile, $false, [System.Text.Encoding]::UTF8)

try {
    $xlsxFiles = Get-ChildItem -Path "c:\MedLogixManage" -Filter "*.xlsx"
    $filePath = $xlsxFiles[0].FullName
    
    $wb = $excel.Workbooks.Open($filePath)
    $ws = $wb.Sheets.Item(1)
    
    $sw.WriteLine("Sheet: $($ws.Name)")
    $usedRange = $ws.UsedRange
    $rows = $usedRange.Rows.Count
    $cols = $usedRange.Columns.Count
    $sw.WriteLine("Total Rows: $rows, Total Cols: $cols")
    $sw.WriteLine("")
    
    # Read ALL rows - scan up to 100 rows
    for($r = 1; $r -le 100; $r++) {
        $rowData = @()
        for($c = 1; $c -le 20; $c++) {
            try {
                $cell = $ws.Cells.Item($r, $c)
                if ($null -ne $cell) {
                    $val = $cell.Value2
                    $formula = ""
                    try { $formula = $cell.Formula } catch {}
                    $validationFormula = ""
                    try { 
                        $dv = $cell.Validation
                        if ($null -ne $dv) {
                            $validationFormula = $dv.Formula1
                        }
                    } catch {}
                    
                    if ($null -ne $val -and $val.ToString().Trim() -ne "") {
                        $entry = "C${c}R${r}=${val}"
                        if ($formula -ne "" -and $formula -ne $val.ToString() -and $formula.StartsWith("=")) {
                            $entry += " [F:$formula]"
                        }
                        if ($validationFormula -ne "") {
                            $entry += " [DROP:$validationFormula]"
                        }
                        $rowData += $entry
                    } elseif ($validationFormula -ne "") {
                        # Empty cell but has validation
                        $rowData += "C${c}R${r}=(empty) [DROP:$validationFormula]"
                    }
                }
            } catch {}
        }
        if ($rowData.Count -gt 0) {
            $sw.WriteLine("Row $r : $($rowData -join ' | ')")
        }
    }
    
    # Also check for named ranges
    $sw.WriteLine("")
    $sw.WriteLine("=== Named Ranges ===")
    foreach($name in $wb.Names) {
        try {
            $sw.WriteLine("$($name.Name) = $($name.RefersTo)")
        } catch {}
    }
    
    # Check all sheet names and their used ranges
    $sw.WriteLine("")
    $sw.WriteLine("=== All Sheet Structures ===")
    for($si = 1; $si -le $wb.Sheets.Count; $si++) {
        try {
            $s = $wb.Sheets.Item($si)
            $ur = $s.UsedRange
            $addr = ""
            if ($null -ne $ur) { $addr = $ur.Address }
            $sw.WriteLine("Sheet $si '$($s.Name)': UsedRange=$addr, Rows=$($ur.Rows.Count), Cols=$($ur.Columns.Count)")
        } catch {
            $sw.WriteLine("Sheet $si : Error reading")
        }
    }
    
    $sw.WriteLine("`nDone.")
    $wb.Close($false)
} catch {
    $sw.WriteLine("Error: $_")
} finally {
    $sw.Close()
    try { $excel.Quit() } catch {}
    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host "Done"
