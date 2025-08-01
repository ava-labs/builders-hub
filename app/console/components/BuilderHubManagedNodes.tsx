"use client";

import { Container } from "../../../toolbox/src/components/Container";
import { Button } from "@/components/ui/button";
import { Server, Zap, Shield, Clock } from "lucide-react";

export default function BuilderHubManagedNodes() {
  return (
    <Container
      title="BuilderHub Managed Nodes"
      description="Deploy and manage your L1 nodes with BuilderHub's managed infrastructure - coming soon!"
    >
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Server className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Managed Node Infrastructure</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Skip the complexity of managing your own infrastructure. BuilderHub will handle node deployment, 
            monitoring, and maintenance for your L1 blockchain.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold">One-Click Deployment</h3>
            <p className="text-sm text-muted-foreground">
              Deploy validator and RPC nodes instantly without manual server setup or Docker configuration.
            </p>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold">Enterprise Security</h3>
            <p className="text-sm text-muted-foreground">
              Bank-grade security with automated backups, monitoring, and 99.9% uptime SLA.
            </p>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold">24/7 Monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Continuous health monitoring with automatic scaling and incident response.
            </p>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200">Coming Soon</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                BuilderHub Managed Nodes is currently in development. In the meantime, you can use the 
                self-hosted Docker setup to deploy your nodes manually.
              </p>
              <div className="mt-4 flex space-x-3">
                <Button variant="outline" size="sm">
                  Join Waitlist
                </Button>
                <Button variant="ghost" size="sm">
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Alternative Path */}
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-3">Alternative: Self-Hosted Setup</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ready to deploy now? Use our Docker-based self-hosted setup to get your nodes running today.
          </p>
          <Button variant="outline" className="w-full">
            Continue with Self-Hosted Setup →
          </Button>
        </div>
      </div>
    </Container>
  );
}