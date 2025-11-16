import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettings } from '../../hooks/useSettings';
import { apiTestService } from '../../services/apiTestService';
import { Key, Database, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const DataSourcesTab = () => {
  const { settings, setSetting } = useSettings();

  // Local state for API keys (for editing)
  const [deepseekKey, setDeepseekKey] = useState(settings.deepseek_api_key);
  const [googleKey, setGoogleKey] = useState(settings.google_api_key);
  const [sheetId, setSheetId] = useState(settings.google_sheet_id);
  const [sheetName, setSheetName] = useState(settings.google_sheet_name);

  // Visibility toggles
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);

  // Loading states
  const [testingDeepseek, setTestingDeepseek] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);

  // Status states
  const [deepseekStatus, setDeepseekStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSaveDeepseek = () => {
    setSetting('deepseek_api_key', deepseekKey, true);
  };

  const handleSaveGoogle = () => {
    setSetting('google_api_key', googleKey, true);
  };

  const handleSaveSheetConfig = () => {
    setSetting('google_sheet_id', sheetId, false);
    setSetting('google_sheet_name', sheetName, false);
    toast.success('تنظیمات Google Sheets ذخیره شد');
  };

  const handleTestDeepseek = async () => {
    setTestingDeepseek(true);
    setDeepseekStatus('idle');

    try {
      const result = await apiTestService.testDeepSeek(deepseekKey);

      if (result.success) {
        setDeepseekStatus('success');
        toast.success(result.message);
      } else {
        setDeepseekStatus('error');
        toast.error(result.message);
      }
    } catch (error) {
      setDeepseekStatus('error');
      toast.error('خطا در تست اتصال');
    } finally {
      setTestingDeepseek(false);
    }
  };

  const handleTestGoogle = async () => {
    setTestingGoogle(true);
    setGoogleStatus('idle');

    try {
      const result = await apiTestService.testGoogleSheets(googleKey, sheetId);

      if (result.success) {
        setGoogleStatus('success');
        toast.success(result.message);
      } else {
        setGoogleStatus('error');
        toast.error(result.message);
      }
    } catch (error) {
      setGoogleStatus('error');
      toast.error('خطا در تست اتصال');
    } finally {
      setTestingGoogle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* DeepSeek API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            DeepSeek API
          </CardTitle>
          <CardDescription>
            کلید API برای تحلیل هوشمند محتوا
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>کلید API</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showDeepseekKey ? 'text' : 'password'}
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowDeepseekKey(!showDeepseekKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showDeepseekKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {deepseekStatus === 'success' && (
                <CheckCircle2 className="h-10 w-10 text-success flex-shrink-0" />
              )}
              {deepseekStatus === 'error' && (
                <XCircle className="h-10 w-10 text-danger flex-shrink-0" />
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveDeepseek}
              disabled={deepseekKey === settings.deepseek_api_key}
            >
              ذخیره
            </Button>

            <Button
              onClick={handleTestDeepseek}
              variant="outline"
              disabled={!deepseekKey || testingDeepseek}
            >
              {testingDeepseek && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              تست اتصال
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Google Sheets API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Google Sheets API
          </CardTitle>
          <CardDescription>
            اتصال به Google Sheets برای همگام‌سازی داده‌ها
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google API Key */}
          <div className="space-y-2">
            <Label>کلید Google API</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showGoogleKey ? 'text' : 'password'}
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  placeholder="AIza..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {googleStatus === 'success' && (
                <CheckCircle2 className="h-10 w-10 text-success flex-shrink-0" />
              )}
              {googleStatus === 'error' && (
                <XCircle className="h-10 w-10 text-danger flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Sheet ID */}
          <div className="space-y-2">
            <Label>Sheet ID</Label>
            <Input
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1EfjB4eQq6Kv..."
              dir="ltr"
            />
          </div>

          {/* Sheet Name */}
          <div className="space-y-2">
            <Label>نام Sheet</Label>
            <Input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Sheet1"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveGoogle}
              disabled={googleKey === settings.google_api_key}
            >
              ذخیره کلید API
            </Button>

            <Button
              onClick={handleSaveSheetConfig}
              variant="outline"
              disabled={
                sheetId === settings.google_sheet_id &&
                sheetName === settings.google_sheet_name
              }
            >
              ذخیره تنظیمات Sheet
            </Button>

            <Button
              onClick={handleTestGoogle}
              variant="outline"
              disabled={!googleKey || !sheetId || testingGoogle}
            >
              {testingGoogle && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              تست اتصال
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataSourcesTab;
