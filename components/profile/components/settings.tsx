"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <Separator />

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Account Settings</Label>
          <p className="text-sm text-muted-foreground">
            Configure your account preferences and security settings.
          </p>
        </div>

        {/* Add more settings fields as needed */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Notification Preferences</Label>
            <p className="text-sm text-muted-foreground">
              Manage how you receive notifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

