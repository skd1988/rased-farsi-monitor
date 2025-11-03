import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNewAuth } from '@/contexts/NewAuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Debug = () => {
  const { user, loading } = useNewAuth();
  const [authUser, setAuthUser] = useState<any>(null);
  const [roleData, setRoleData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check current session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session:', session);
        setAuthUser(session?.user);

        if (session?.user) {
          // Try to fetch role directly
          const { data: role, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .single();

          console.log('Role data:', role);
          console.log('Role error:', roleError);
          
          if (roleError) {
            setError(roleError.message);
          } else {
            setRoleData(role);
          }
        }
      } catch (err: any) {
        console.error('Error:', err);
        setError(err.message);
      }
    };

    checkAuth();
  }, []);

  const testRLSDirectly = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setError('No session found');
        return;
      }

      // Test with raw query
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', session.user.id);

      console.log('RLS Test Result:', { data, error });
      
      if (error) {
        setError(`RLS Test Failed: ${error.message}`);
      } else {
        setError(`RLS Test Passed! Found ${data?.length} role(s)`);
        setRoleData(data);
      }
    } catch (err: any) {
      setError(`Exception: ${err.message}`);
    }
  };

  return (
    <div className="p-8 space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">صفحه Debug</h1>

      <Card className="p-4">
        <h2 className="font-bold mb-2">وضعیت Auth Context:</h2>
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
          {JSON.stringify({ user, loading }, null, 2)}
        </pre>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Supabase Session User:</h2>
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
          {JSON.stringify(authUser, null, 2)}
        </pre>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Role Data:</h2>
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
          {JSON.stringify(roleData, null, 2)}
        </pre>
      </Card>

      {error && (
        <Card className="p-4 border-red-500">
          <h2 className="font-bold mb-2 text-red-500">Error:</h2>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-24">{error}</pre>
        </Card>
      )}

      <Button onClick={testRLSDirectly}>
        تست مستقیم RLS
      </Button>
    </div>
  );
};

export default Debug;
