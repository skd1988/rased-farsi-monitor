import { useEffect, useState } from 'react';
import { Globe, RefreshCw, Loader2, CheckCircle, XCircle, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TargetAvatar } from '@/components/targets/TargetAvatar';
import { fetchPhotosForTargets } from '@/lib/photoFetcher';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const normalize = (value?: string | null) =>
  (value ?? '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const buildKey = (item: { name_persian?: string | null; name_english?: string | null; name_arabic?: string | null }) => {
  const np = normalize(item.name_persian);
  const ne = normalize(item.name_english);
  const na = normalize(item.name_arabic);
  return np || ne || na;
};

type TargetKind = 'entity' | 'person';

interface TargetItem {
  key: string;
  kind: TargetKind;
  name_persian?: string | null;
  name_english?: string | null;
  name_arabic?: string | null;
  entity_type?: string | null;
  location?: string | null;
  position?: string | null;
  postsCount: number;
  photo_url?: string | null;
  photo_source?: string | null;
  hasPersianName: boolean;
  linkedEntityId?: string | null;
  linkedPersonId?: string | null;
}

export default function PhotoManagement() {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<'all' | 'with-photo' | 'without-photo'>('all');
  const [editPersianNames, setEditPersianNames] = useState<Record<string, string>>({});
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const [suggestingNameId, setSuggestingNameId] = useState<string | null>(null);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const [{ data: posts, error: postsError }, { data: profiles, error: profilesError }, { data: entities, error: entitiesError }, { data: persons, error: personsError }] =
        await Promise.all([
          supabase.from('posts').select('target_entity, target_persons').eq('is_psyop', true),
          supabase.from('target_profiles').select('name_english, name_persian, photo_url, photo_source'),
          supabase.from('resistance_entities').select('id, name_persian, name_english, name_arabic, entity_type, location, active'),
          supabase.from('resistance_persons').select('id, name_persian, name_english, name_arabic, role, entity_id, active'),
        ]);

      if (postsError) throw postsError;
      if (profilesError) throw profilesError;
      if (entitiesError) throw entitiesError;
      if (personsError) throw personsError;

      const targetMap = new Map<string, TargetItem>();

      const addTarget = (item: any, kind: TargetKind) => {
        const key = buildKey(item);
        if (!key) return;

        const existing = targetMap.get(key);
        const base: TargetItem = existing || {
          key,
          kind,
          name_persian: item.name_persian ?? null,
          name_english: item.name_english ?? null,
          name_arabic: item.name_arabic ?? null,
          entity_type: item.entity_type ?? null,
          location: item.location ?? null,
          position: item.position ?? item.role ?? null,
          postsCount: 0,
          photo_url: null,
          photo_source: null,
          hasPersianName: !!(item.name_persian && item.name_persian.trim()),
          linkedEntityId: null,
          linkedPersonId: null,
        };

        base.postsCount += 1;
        targetMap.set(key, base);
      };

      posts?.forEach((post) => {
        const entitiesFromPost = Array.isArray(post.target_entity)
          ? post.target_entity
          : post.target_entity
            ? [post.target_entity]
            : [];

        entitiesFromPost.forEach((entity: any) => {
          let parsedEntity = entity;
          if (typeof entity === 'string') {
            try {
              parsedEntity = JSON.parse(entity);
            } catch {
              parsedEntity = { name_persian: entity };
            }
          }
          addTarget(parsedEntity, 'entity');
        });

        const personsFromPost = Array.isArray(post.target_persons) ? post.target_persons : [];
        personsFromPost.forEach((person: any) => {
          let parsedPerson = person;
          if (typeof person === 'string') {
            try {
              parsedPerson = JSON.parse(person);
            } catch {
              parsedPerson = { name_persian: person };
            }
          }
          addTarget(parsedPerson, 'person');
        });
      });

      const targetsArray = Array.from(targetMap.values()).map((item) => {
        if (item.kind === 'entity') {
          const targetNames = [normalize(item.name_persian), normalize(item.name_english), normalize(item.name_arabic)].filter(Boolean);
          const matchedEntity = entities?.find((ent) => {
            const entityNames = [normalize(ent.name_persian), normalize(ent.name_english)];
            return entityNames.some((n) => n && targetNames.includes(n));
          });

          const finalPersian = matchedEntity?.name_persian ?? item.name_persian ?? null;
          const finalEnglish = matchedEntity?.name_english ?? item.name_english ?? null;
          const finalArabic = matchedEntity?.name_arabic ?? item.name_arabic ?? null;

          const profile = profiles?.find(
            (p) =>
              p.name_english === item.name_english ||
              p.name_english === finalEnglish ||
              p.name_persian === finalPersian,
          );

          return {
            ...item,
            name_persian: finalPersian,
            name_english: finalEnglish,
            name_arabic: finalArabic,
            entity_type: matchedEntity?.entity_type ?? item.entity_type ?? null,
            location: matchedEntity?.location ?? item.location ?? null,
            hasPersianName: !!(finalPersian && finalPersian.trim()),
            linkedEntityId: matchedEntity?.id ?? null,
            photo_url: profile?.photo_url ?? item.photo_url ?? null,
            photo_source: profile?.photo_source ?? item.photo_source ?? null,
          } as TargetItem;
        }

        const targetNames = [normalize(item.name_persian), normalize(item.name_english), normalize(item.name_arabic)].filter(Boolean);
        const matchedPerson = persons?.find((person) => {
          const personNames = [normalize(person.name_persian), normalize(person.name_english), normalize(person.name_arabic)];
          return personNames.some((n) => n && targetNames.includes(n));
        });

        const finalPersian = matchedPerson?.name_persian ?? item.name_persian ?? null;
        const finalEnglish = matchedPerson?.name_english ?? item.name_english ?? null;
        const finalArabic = matchedPerson?.name_arabic ?? item.name_arabic ?? null;

        const profile = profiles?.find(
          (p) =>
            p.name_english === item.name_english ||
            p.name_english === finalEnglish ||
            p.name_persian === finalPersian,
        );

        return {
          ...item,
          name_persian: finalPersian,
          name_english: finalEnglish,
          name_arabic: finalArabic,
          position: matchedPerson?.role ?? item.position ?? null,
          hasPersianName: !!(finalPersian && finalPersian.trim()),
          linkedPersonId: matchedPerson?.id ?? null,
          photo_url: profile?.photo_url ?? item.photo_url ?? null,
          photo_source: profile?.photo_source ?? item.photo_source ?? null,
        } as TargetItem;
      });

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
  };

  const handleFetchFromWikipedia = async () => {
    const targetsWithoutPhotos = targets.filter((t) => !t.photo_url);

    if (targetsWithoutPhotos.length === 0) {
      toast.info('همه اهداف دارای تصویر هستند');
      return;
    }

    setFetching(true);
    setProgress({ current: 0, total: targetsWithoutPhotos.length });

    try {
      console.log(`📋 Starting to fetch photos for ${targetsWithoutPhotos.length} targets`, targetsWithoutPhotos);

      const results = await fetchPhotosForTargets(targetsWithoutPhotos, (current, total) => setProgress({ current, total }));

      console.log(`✅ Fetch complete. Got ${results.size} photos from Wikipedia`);
      toast.success(`${results.size} تصویر از Wikipedia دریافت و ذخیره شد`);

      await fetchTargets();
    } catch (error) {
      console.error('❌ Failed to fetch from Wikipedia:', error);
      toast.error('خطا در دریافت تصاویر از Wikipedia');
    } finally {
      setFetching(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleSavePersianName = async (target: TargetItem) => {
    const raw = editPersianNames[target.key] ?? target.name_persian ?? '';
    const newName = raw.trim();
    if (!newName) {
      toast.error('نام فارسی نمی‌تواند خالی باشد');
      return;
    }

    setSavingNameId(target.key);

    try {
      if (target.kind === 'entity') {
        let entityId = target.linkedEntityId;

        if (entityId) {
          const { error } = await supabase
            .from('resistance_entities')
            .update({ name_persian: newName })
            .eq('id', entityId);

          if (error) throw error;
        } else {
          const payload: any = {
            name_persian: newName,
            name_english: target.name_english,
            name_arabic: target.name_arabic,
            entity_type: target.entity_type || 'Organization',
            active: true,
          };

          if (target.location && typeof target.location === 'string') {
            const loc = target.location.trim();
            if (loc) {
              payload.location = loc;
            }
          }

          const { data, error } = await supabase
            .from('resistance_entities')
            .insert(payload)
            .select('id')
            .single();

          if (error) throw error;
          entityId = data?.id;
        }

        const profileKey = target.name_english || newName;
        if (profileKey) {
          const { data: existingProfile, error: profileSelectError } = await supabase
            .from('target_profiles')
            .select('name_english')
            .eq('name_english', profileKey)
            .maybeSingle();

          if (profileSelectError) throw profileSelectError;

          if (existingProfile) {
            const { error: profileUpdateError } = await supabase
              .from('target_profiles')
              .update({ name_persian: newName })
              .eq('name_english', profileKey);

            if (profileUpdateError) throw profileUpdateError;
          } else {
            const { error: profileInsertError } = await supabase.from('target_profiles').insert({
              name_english: profileKey,
              name_persian: newName,
              photo_url: target.photo_url ?? null,
              photo_source: target.photo_source ?? null,
            });

            if (profileInsertError) throw profileInsertError;
          }
        }

        setTargets((prev) =>
          prev.map((t) =>
            t.key === target.key
              ? {
                  ...t,
                  name_persian: newName,
                  hasPersianName: true,
                  linkedEntityId: entityId,
                }
              : t,
          ),
        );
      } else {
        let personId = target.linkedPersonId;

        if (personId) {
          const { error } = await supabase
            .from('resistance_persons')
            .update({ name_persian: newName })
            .eq('id', personId);

          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('resistance_persons')
            .insert({
              name_persian: newName,
              name_english: target.name_english,
              name_arabic: target.name_arabic,
              active: true,
            })
            .select('id')
            .single();

          if (error) throw error;
          personId = data?.id;
        }

        const profileKey = target.name_english || newName;
        if (profileKey) {
          const { data: existingProfile, error: profileSelectError } = await supabase
            .from('target_profiles')
            .select('name_english')
            .eq('name_english', profileKey)
            .maybeSingle();

          if (profileSelectError) throw profileSelectError;

          if (existingProfile) {
            const { error: profileUpdateError } = await supabase
              .from('target_profiles')
              .update({ name_persian: newName })
              .eq('name_english', profileKey);

            if (profileUpdateError) throw profileUpdateError;
          } else {
            const { error: profileInsertError } = await supabase.from('target_profiles').insert({
              name_english: profileKey,
              name_persian: newName,
              photo_url: target.photo_url ?? null,
              photo_source: target.photo_source ?? null,
            });

            if (profileInsertError) throw profileInsertError;
          }
        }

        setTargets((prev) =>
          prev.map((t) =>
            t.key === target.key
              ? {
                  ...t,
                  name_persian: newName,
                  hasPersianName: true,
                  linkedPersonId: personId,
                }
              : t,
          ),
        );
      }

      toast.success('نام فارسی ذخیره شد');
    } catch (error) {
      console.error('خطا در ذخیره نام فارسی', error);
      toast.error('خطا در ذخیره نام فارسی');
    } finally {
      setSavingNameId(null);
    }
  };

  const handleSuggestPersianName = async (target: TargetItem) => {
    const hasAnyName = [target.name_persian, target.name_english, target.name_arabic]
      .map((n) => (n ?? '').toString().trim())
      .some((n) => !!n);

    if (!hasAnyName) {
      toast.error('برای پیشنهاد هوشمند، حداقل یکی از نام‌های فارسی/انگلیسی/عربی لازم است');
      return;
    }

    setSuggestingNameId(target.key);

    try {
      const { data, error } = await supabase.functions.invoke('suggest-target-name', {
        body: {
          kind: target.kind,
          name_english: target.name_english ?? null,
          name_arabic: target.name_arabic ?? null,
          name_persian: target.name_persian ?? null,
        },
      });

      if (error) {
        console.error('خطا در دریافت پیشنهاد نام', error);
        toast.error('خطا در دریافت پیشنهاد نام');
        return;
      }

      const suggested = (data?.suggested_persian ?? '').trim();
      if (!suggested) {
        toast.error('پیشنهادی دریافت نشد');
      } else {
        setEditPersianNames((prev) => ({ ...prev, [target.key]: suggested }));
        toast.success('نام پیشنهادی دریافت شد');
      }
    } catch (err) {
      console.error('خطا در پیشنهاد نام', err);
      toast.error('خطا در دریافت پیشنهاد نام');
    } finally {
      setSuggestingNameId(null);
    }
  };

  const filteredTargets = targets.filter((t) => {
    if (filter === 'with-photo') return !!t.photo_url;
    if (filter === 'without-photo') return !t.photo_url;
    return true;
  });

  const statsWithPhoto = targets.filter((t) => t.photo_url).length;
  const statsWithoutPhoto = targets.filter((t) => !t.photo_url).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">مدیریت تصاویر و اسامی اهداف</h1>
            <p className="text-muted-foreground mt-1">
              {statsWithPhoto} از {targets.length} هدف دارای تصویر هستند
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleFetchFromWikipedia} disabled={fetching || loading} variant="default">
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

            <Button onClick={fetchTargets} disabled={loading || fetching} variant="outline">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {fetching && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>در حال دریافت تصاویر...</span>
                  <span>
                    {progress.current} از {progress.total}
                  </span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button onClick={() => setFilter('all')} variant={filter === 'all' ? 'default' : 'outline'}>
            همه ({targets.length})
          </Button>
          <Button onClick={() => setFilter('with-photo')} variant={filter === 'with-photo' ? 'default' : 'outline'}>
            <CheckCircle className="w-4 h-4 ml-2" />
            با تصویر ({statsWithPhoto})
          </Button>
          <Button onClick={() => setFilter('without-photo')} variant={filter === 'without-photo' ? 'default' : 'outline'}>
            <XCircle className="w-4 h-4 ml-2" />
            بدون تصویر ({statsWithoutPhoto})
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTargets.map((target) => {
              const displayName = target.name_persian || target.name_english || target.name_arabic || 'بدون نام';

              return (
                <Card key={target.key} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <TargetAvatar
                        target={target}
                        size="lg"
                        showUpload={true}
                        onPhotoUpdate={async () => {
                          await fetchTargets();
                        }}
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold truncate text-foreground">{displayName}</div>
                          <div className="flex gap-2">
                            <Badge variant="secondary">{target.kind === 'entity' ? 'نهاد' : 'فرد'}</Badge>
                            {target.hasPersianName ? (
                              <Badge variant="default">نام فارسی ثبت شده</Badge>
                            ) : (
                              <Badge variant="destructive">نیازمند ترجمه</Badge>
                            )}
                          </div>
                        </div>
                        {target.name_english && (
                          <div className="text-xs text-muted-foreground truncate">{target.name_english}</div>
                        )}
                        {target.position && (
                          <div className="text-xs text-muted-foreground truncate">{target.position}</div>
                        )}
                        {target.photo_source && (
                          <div className="text-xs text-primary mt-1">منبع: {target.photo_source}</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Input
                        dir="rtl"
                        value={editPersianNames[target.key] ?? target.name_persian ?? ''}
                        onChange={(e) =>
                          setEditPersianNames((prev) => ({
                            ...prev,
                            [target.key]: e.target.value,
                          }))
                        }
                        placeholder="نام فارسی را وارد کنید"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleSuggestPersianName(target)}
                          disabled={suggestingNameId === target.key || savingNameId === target.key}
                        >
                          {suggestingNameId === target.key ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              در حال پیشنهاد...
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-4 h-4 ml-2" />
                              پیشنهاد هوشمند
                            </>
                          )}
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => handleSavePersianName(target)}
                          disabled={savingNameId === target.key || suggestingNameId === target.key}
                        >
                          {savingNameId === target.key ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              در حال ذخیره...
                            </>
                          ) : (
                            'ذخیره نام فارسی'
                          )}
                        </Button>
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
