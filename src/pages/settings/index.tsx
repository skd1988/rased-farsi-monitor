import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Database, Shield, Palette, Zap } from 'lucide-react';
import AppearanceTab from './tabs/AppearanceTab';
import DataSourcesTab from './tabs/DataSourcesTab';
import AutomationTab from './tabs/AutomationTab';

const SettingsPage = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">تنظیمات</h1>
        <p className="text-muted-foreground">
          مدیریت تنظیمات سیستم AFTAB Intelligence
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">کاربران</span>
          </TabsTrigger>

          <TabsTrigger value="data-sources" className="gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">منابع داده</span>
          </TabsTrigger>

          <TabsTrigger value="monitoring" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">رصد</span>
          </TabsTrigger>

          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">ظاهر</span>
          </TabsTrigger>

          <TabsTrigger value="automation" className="gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">اتوماسیون</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="text-center py-12 text-muted-foreground">
            بخش مدیریت کاربران (در حال توسعه)
          </div>
        </TabsContent>

        <TabsContent value="data-sources" className="space-y-6">
          <DataSourcesTab />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <div className="text-center py-12 text-muted-foreground">
            بخش قوانین رصد (در حال توسعه)
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <AppearanceTab />
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <AutomationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
