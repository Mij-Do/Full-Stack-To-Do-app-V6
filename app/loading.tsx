import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const SKELETON_ROWS = 5;

export default function Loading() {
    return (
        <div className="w-full space-y-4">
            {/* 1. Mobile View Skeleton */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <div
                        key={i}
                        className="p-4 border rounded-xl space-y-3 bg-card shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                        </div>
                        <div className="pt-2 border-t flex justify-end items-center space-x-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-8" />
                </div>
            </div>

            {/* 2. Desktop View Skeleton */}
            <div className="hidden md:block w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Body</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell>
                                    <Skeleton className="h-4 w-32" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-48" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </TableCell>
                                <TableCell className="flex items-center justify-end space-x-2">
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}