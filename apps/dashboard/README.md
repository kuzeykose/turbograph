# GitHub Authentication with Supabase - Static Site

This Next.js application demonstrates client-side GitHub OAuth authentication using Supabase, configured for static site generation.

## Features

- ✅ GitHub OAuth authentication via Supabase
- ✅ Static site generation (`output: 'export'`)
- ✅ Client-side route protection
- ✅ Protected dashboard with user information
- ✅ GitHub repositories viewer with real-time data
- ✅ Repository file browser with code viewer
- ✅ Navigate through repository directories
- ✅ View file contents with line numbers
- ✅ Modern, responsive UI with Tailwind CSS
- ✅ TypeScript support

## Prerequisites

- Node.js 18+ installed
- A Supabase account ([sign up here](https://supabase.com))
- A GitHub OAuth App configured

## Setup Instructions

### 1. Configure GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Your app name
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/auth/callback`
4. Click "Register application"
5. Note down your **Client ID** and generate a **Client Secret**

### 2. Configure Supabase

1. Create a new project in [Supabase Dashboard](https://app.supabase.com)
2. Go to **Authentication** > **Providers** > **GitHub**
3. Enable GitHub provider
4. Enter your GitHub OAuth **Client ID** and **Client Secret**
5. **Important**: Add the following scopes to access repositories:
   - `repo` - Full control of private repositories
   - Or use `public_repo` - Access to public repositories only
6. Copy the **Callback URL** from Supabase (should be `https://<project-ref>.supabase.co/auth/v1/callback`)
7. Go back to your GitHub OAuth App settings and add this as an additional callback URL

**Note**: The `repo` scope is required to fetch repositories using the GitHub API. Without it, the repositories page will show an error.

### 3. Configure Environment Variables

1. Copy the `.env.local` file in the project root
2. Get your Supabase credentials:
   - Go to **Project Settings** > **API** in Supabase Dashboard
   - Copy your **Project URL** and **anon/public key**
3. Update `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Install Dependencies

```bash
pnpm install
```

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Building for Production

### Static Export

Build the static site:

```bash
pnpm build
```

This generates static files in the `out/` directory.

### Deploy Static Files

Upload the entire `out/` directory to your static hosting provider:

- **Netlify**: Drag and drop the `out/` folder
- **Vercel**: Connect your Git repository
- **GitHub Pages**: Push to `gh-pages` branch
- **Cloudflare Pages**: Connect your repository
- **AWS S3**: Upload using AWS CLI or Console

**Important**: Configure your hosting to serve `index.html` for all routes (SPA mode).

### Production OAuth Configuration

After deploying, update your OAuth callback URLs:

1. **GitHub OAuth App**: Add `https://yourdomain.com/auth/callback`
2. **Supabase**: Add `https://yourdomain.com` to allowed redirect URLs
   - Go to **Authentication** > **URL Configuration** in Supabase
   - Add your production domain to **Redirect URLs**

## Application Structure

```
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── page.tsx          # OAuth callback handler
│   ├── dashboard/
│   │   └── page.tsx              # Protected dashboard page
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── repositories/
│   │   └── page.tsx              # GitHub repositories viewer
│   ├── repository/
│   │   └── [owner]/
│   │       └── [repo]/
│   │           └── page.tsx      # Repository file browser and viewer
│   ├── layout.tsx                # Root layout with AuthProvider
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   ├── auth/
│   │   └── sign-out-button.tsx   # Sign out button component
│   └── code-viewer.tsx            # Code viewer with line numbers
├── contexts/
│   └── auth-context.tsx          # Authentication context provider
├── lib/
│   ├── supabase/
│   │   └── client.ts             # Supabase client configuration
│   └── utils/
│       └── language-colors.ts    # GitHub language color utilities
├── .env.local                     # Environment variables (not in git)
└── next.config.ts                # Next.js configuration
```

## How It Works

### Authentication Flow

1. User clicks "Sign in with GitHub" on `/login`
2. Redirected to GitHub OAuth consent screen
3. After approval, GitHub redirects to `/auth/callback`
4. Supabase extracts tokens and creates session
5. Session stored in browser localStorage
6. User redirected to `/dashboard`

### GitHub API Integration

The application integrates with multiple GitHub REST API endpoints:

**Repository List** (`/repositories`):
1. Fetches all user repositories from `https://api.github.com/user/repos`
2. Displays metadata: stars, forks, language, privacy status
3. Language colors dynamically rendered based on GitHub's color scheme

**Repository Viewer** (`/repository/[owner]/[repo]`):
1. Fetches repository details from `GET /repos/{owner}/{repo}`
2. Browses directory structure using `GET /repos/{owner}/{repo}/contents/{path}`
3. Displays files with line numbers and copy functionality
4. Supports navigation through folders
5. Decodes base64-encoded file contents automatically

### Client-Side Protection

Protected routes (like `/dashboard`) check authentication status in the browser:

```typescript
useEffect(() => {
  if (!loading && !user) {
    router.push('/login');
  }
}, [user, loading, router]);
```

**Note**: This is client-side only. The page briefly renders before redirecting unauthenticated users. Use Supabase Row Level Security (RLS) to protect your data.

### Repository File Browser

The repository viewer (`/repository/[owner]/[repo]`) provides:

1. **Directory Navigation**: Browse through folders by clicking directory names
2. **Breadcrumb Navigation**: Click any path segment to jump back
3. **File Viewer**: Click files to view contents with line numbers
4. **Copy to Clipboard**: One-click copy of file contents
5. **File Metadata**: Shows file size and detected language
6. **Sorted Display**: Directories first, then files (alphabetically)

The viewer uses the [GitHub Contents API](https://docs.github.com/en/rest/repos/contents) to fetch file and directory contents dynamically.

## Important Considerations

### Security

- **Client-Side Only**: All authentication checks happen in the browser
- **No Server Protection**: Anyone can view the static HTML/JS files
- **Data Security**: Use Supabase RLS policies to protect sensitive data
- **Session Storage**: Sessions stored in localStorage (not HTTP-only cookies)

### Limitations

- Protected pages flash briefly before redirecting unauthenticated users
- Cannot use Server Components, API Routes, or Middleware
- Session management relies entirely on client-side JavaScript

### Best Practices

1. **Never expose sensitive data** in static files
2. **Always use RLS** for database queries
3. **Keep anon key safe** but know it's visible in client code
4. **Never use service role key** in client-side code
5. **Use HTTPS** in production for security

## Development Tips

### Testing Authentication Locally

1. Ensure `.env.local` has correct Supabase credentials
2. GitHub OAuth callback must include `http://localhost:3000/auth/callback`
3. Clear browser localStorage if having session issues

### Common Issues

**Issue**: "Invalid redirect URL"
- **Fix**: Add callback URL to both GitHub OAuth App and Supabase settings

**Issue**: Infinite redirect loop
- **Fix**: Check AuthProvider is wrapping the app in `layout.tsx`

**Issue**: Session not persisting
- **Fix**: Ensure localStorage is enabled in browser

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production (static export)
- `pnpm start` - Start production server (not applicable for static export)
- `pnpm lint` - Run ESLint

## Technologies Used

- **Next.js 16** - React framework with static export
- **React 19** - UI library
- **Supabase** - Authentication and backend
- **TypeScript 5.9** - Type safety
- **Tailwind CSS 3** - Styling
- **@supabase/supabase-js** - Supabase JavaScript client

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth with GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Next.js Static Exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)

## License

MIT
