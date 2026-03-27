import { QueryClient } from '@tanstack/react-query'

/**
 * Shared QueryClient for the application.
 * Configured with sensible defaults for a medical logistics system:
 * - 30s staleTime: data is "fresh" for 30s, reducing unnecessary refetches
 * - 1 retry: retry once on failure, then show error
 * - 5min gcTime: keep unused data in cache for 5 minutes
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,       // 30 seconds
            gcTime: 5 * 60 * 1000,      // 5 minutes (formerly cacheTime)
            retry: 1,
            refetchOnWindowFocus: false, // Don't refetch when user switches tabs
            throwOnError: false,         // Handle errors per-component instead of crashing the whole page
        },
    },
})
