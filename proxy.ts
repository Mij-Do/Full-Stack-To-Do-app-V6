import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

// clerkMiddleware() is required so Clerk can initialize auth state for each
// request (auth() in server components/actions depends on it).
//
// Security boundary (per Clerk's createRouteMatcher migration guide —
// createRouteMatcher is deprecated in @clerk/nextjs 7.x):
//   - app/page.tsx redirects signed-out users to /sign-in
//   - every Server Action in prisma/actions/todo.action.ts calls
//     requireUserId(), which throws Unauthorized for unauthenticated callers
//   - sign-in/sign-up remain public routes
// Server Actions are invoked by ID, not by path, so a path-based middleware
// gate cannot protect them; the per-action checks are the security boundary.
//
// The redirect below is a pure performance optimization for the home page
// (early redirect for signed-out users, as documented by Clerk). It is not
// an authorization guarantee — removing it would not expose protected data.
// It uses a plain local redirect (not Clerk's redirectToSignIn()) so it also
// works during keyless dev bootstrap, when no publishable key exists yet.
export default clerkMiddleware(async (auth, req) => {
    if (req.nextUrl.pathname === '/') {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.redirect(new URL('/sign-in', req.url));
        }
    }
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/__clerk/:path*',
        '/(api|trpc)(.*)',
    ],
};
