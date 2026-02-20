"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Sun, Moon, Monitor } from "@workspace/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

const themeOptions = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

function ThemeTabs() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="grid grid-cols-3 rounded-lg bg-muted p-1">
      {themeOptions.map(({ value, icon: Icon }) => {
        const isActive = mounted && theme === value;
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`flex items-center justify-center rounded-md p-1.5 transition-all ${
              isActive
                ? "bg-background text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-border"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
            aria-label={`Set theme to ${value}`}
            aria-pressed={isActive}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export function UserMenu() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const userMetadata = user.user_metadata;
  const avatarUrl = userMetadata?.avatar_url;
  const fullName = userMetadata?.full_name || userMetadata?.name;
  const username = userMetadata?.user_name || userMetadata?.preferred_username;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName || username || "User avatar"}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {(fullName || username || user.email || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="px-3 py-2.5 font-normal">
          <div className="flex flex-col gap-1 overflow-hidden">
            {(fullName || username) && (
              <p className="truncate text-sm font-medium leading-none">
                {fullName || username}
              </p>
            )}
            <p className="truncate text-xs text-muted-foreground leading-none">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="px-3 py-1.5">
          <Link href="/settings">Account Preferences</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="px-3 py-1.5 justify-between focus:bg-transparent"
        >
          Theme
          <ThemeTabs />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="px-3 py-1.5">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
