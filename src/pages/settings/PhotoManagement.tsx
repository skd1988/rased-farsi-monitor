import { useState, useEffect } from 'react';
import { Globe, RefreshCw, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TargetAvatar } from '@/components/targets/TargetAvatar';
import { fetchPhotosForTargets } from '@/lib/photoFetcher';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function PhotoManagement() {
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<'all' | 'with-photo' | 'without-photo'>('all');
  
  useEffect(() => {
    fetchTargets();
  }, []);
  
  async function fetchTargets() {
    setLoading(true);
    
    try {
      // Get all unique targets from posts
      const { data: posts, error } = await supabase
        .from('posts')
        .select('target_entity, target_persons')
        .eq('is_psyop', true);
      
      if (error) throw error;
      
      // Extract unique targets
      const targetMap = new Map();
      
      posts?.forEach(post => {
        // Process target_entity
        const entities = Array.isArray(post.target_entity) 
          ? post.target_entity 
          : post.target_entity ? [post.target_entity] : [];
        
        entities.forEach((entity: any) => {
          let parsedEntity = entity;
          if (typeof entity === 'string') {
            try {
              parsedEntity = JSON.parse(entity);
            } catch {
              parsedEntity = { name_persian: entity };
            }
          }
          
          const name = parsedEntity.name_english || parsedEntity.name_persian || parsedEntity.name_arabic;
          if (name && !targetMap.has(name)) {
            targetMap.set(name, parsedEntity);
          }
        });
        
        // Process target_persons
        const persons = Array.isArray(post.target_persons) ? post.target_persons : [];
        persons.forEach((person: any) => {
          let parsedPerson = person;
          if (typeof person === 'string') {
            try {
              parsedPerson = JSON.parse(person);
            } catch {
              parsedPerson = { name_persian: person };
            }
          }
          
          const name = parsedPerson.name_english || parsedPerson.name_persian || parsedPerson.name_arabic;
          if (name && !targetMap.has(name)) {
            targetMap.set(name, parsedPerson);
          }
        });
      });
      
      // Fetch photo URLs from profiles
      const { data: profiles } = await supabase
        .from('target_profiles')
        .select('name_english, name_persian, photo_url, photo_source');
      
      // Merge
      const targetsArray = Array.from(targetMap.values()).map(target => {
        const profile = profiles?.find(p => 
          p.name_english === target.name_english || 
          p.name_persian === target.name_persian
        );
        return {
          ...target,
          photo_url: profile?.photo_url,
          photo_source: profile?.photo_source
        };
      });
      
      // Sort by importance (those without photos first for admins)
      targetsArray.sort((a, b) => {
        if (!a.photo_url && b.photo_url) return -1;
        if (a.photo_url && !b.photo_url) return 1;
        return 0;
      });
      
      setTargets(targetsArray);
      
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      toast.error('خطا در بارگذاری اهداف');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleFetchFromWikipedia() {
    const targetsWithoutPhotos = targets.filter(t => !t.photo_url);
    
    if (targetsWithoutPhotos.length === 0) {
      toast.info('همه اهداف دارای تصویر هستند');
      return;
    }
    
    setFetching(true);
    setProgress({ current: 0, total: targetsWithoutPhotos.length });
    
    try {
      console.log(`📋 Starting to fetch photos for ${targetsWithoutPhotos.length} targets`, targetsWithoutPhotos);
      
      const results = await fetchPhotosForTargets(
        targetsWithoutPhotos,
        (current, total) => setProgress({ current, total })
      );
      
      console.log(`✅ Fetch complete. Got ${results.size} photos from Wikipedia`);
      toast.success(`${results.size} تصویر از Wikipedia دریافت و ذخیره شد`);
      
      // Refresh targets
      await fetchTargets();
      
    } catch (error) {
      console.error('❌ Failed to fetch from Wikipedia:', error);
      toast.error('خطا در دریافت تصاویر از Wikipedia');
    } finally {
      setFetching(false);
      setProgress({ current: 0, total: 0 });
    }
  }
  
  const filteredTargets = targets.filter(t => {
    if (filter === 'with-photo') return !!t.photo_url;
    if (filter === 'without-photo') return !t.photo_url;
    return true;
  });
  
  const statsWithPhoto = targets.filter(t => t.photo_url).length;
  const statsWithoutPhoto = targets.filter(t => !t.photo_url).length;
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">مدیریت تصاویر اهداف</h1>
            <p className="text-muted-foreground mt-1">
              {statsWithPhoto} از {targets.length} هدف دارای تصویر هستند
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handleFetchFromWikipedia}
              disabled={fetching || loading}
              variant="default"
            >
              {fetching ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  در حال دریافت...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 ml-2" />
                  دریافت از Wikipedia
                </>
              )}
            </Button>
            
            <Button
              onClick={fetchTargets}
              disabled={loading || fetching}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        {fetching && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>در حال دریافت تصاویر...</span>
                  <span>{progress.current} از {progress.total}</span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Filter */}
        <div className="flex gap-2">
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'default' : 'outline'}
          >
            همه ({targets.length})
          </Button>
          <Button
            onClick={() => setFilter('with-photo')}
            variant={filter === 'with-photo' ? 'default' : 'outline'}
          >
            <CheckCircle className="w-4 h-4 ml-2" />
            با تصویر ({statsWithPhoto})
          </Button>
          <Button
            onClick={() => setFilter('without-photo')}
            variant={filter === 'without-photo' ? 'default' : 'outline'}
          >
            <XCircle className="w-4 h-4 ml-2" />
            بدون تصویر ({statsWithoutPhoto})
          </Button>
        </div>
        
        {/* Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTargets.map((target) => {
              // Generate unique key from target names
              const uniqueKey = target.name_persian || target.name_english || target.name_arabic || Math.random().toString();

              return (
                <Card key={uniqueKey} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <TargetAvatar
                        target={target}
                        size="lg"
                        showUpload={true}
                        onPhotoUpdate={async () => {
                          await fetchTargets();
                        }}
                      />
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate text-foreground">
                        {target.name_persian || target.name_english || target.name_arabic}
                      </div>
                      {target.name_english && target.name_persian && (
                        <div className="text-xs text-muted-foreground truncate">
                          {target.name_english}
                        </div>
                      )}
                      {target.position && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {target.position}
                        </div>
                      )}
                      {target.photo_source && (
                        <div className="text-xs text-primary mt-1">
                          منبع: {target.photo_source}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
