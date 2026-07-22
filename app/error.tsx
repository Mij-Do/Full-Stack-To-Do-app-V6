'use client' // ضروري جداً!

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('حدث خطأ:', error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-75 gap-4 p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600"> Something Went Wrong!! </h2>
            <p className="text-sm text-gray-500">{error.message}</p>
            <button
                onClick={() => reset()}
                className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-md text-sm font-medium"
            >
                (Try Again)
            </button>
        </div>
    )
}