import { useState, useEffect } from 'react';
import { Globe, RefreshCw, Loader2, CheckCircle, XCircle, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TargetAvatar } from '@/components/targets/TargetAvatar';
import { fetchPhotosForTargets } from '@/lib/photoFetcher';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type TargetKind = 'entity' | 'person';

interface TargetItem {
  key: string;
  kind: TargetKind;
  name_persian?: string;
  name_english?: string;
  name_arabic?: string;
  entity_type?: string;
  location?: string;
  postsCount: number;
  photo_url?: string | null;
  photo_source?: string | null;
  position?: string;
  hasPersianName: boolean;
  linkedEntityId?: string | null;
  linkedPersonId?: string | null;
}

const normalize = (s?: string | null) =>
  (s || '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[--–—'"«»„،,:؛.()]/g, '')
    .toLowerCase();

export default function PhotoManagement() {
  const { toast } = useToast();
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

  async function fetchTargets() {
    setLoading(true);

    try {
      const [postsResponse, profilesResponse, entitiesResponse, personsResponse] =
        await Promise.all([
          supabase.from('posts').select('target_entity, target_persons').eq('is_psyop', true),
          supabase
            .from('target_profiles')
            .select('name_english, name_persian, photo_url, photo_source'),
          supabase
            .from('resistance_entities')
            .select('id, name_persian, name_english, name_arabic, active')
            .eq('active', true),
          supabase
            .from('resistance_persons')
            .select('id, name_persian, name_english, name_arabic, active, role, entity_id')
            .eq('active', true),
        ]);

      if (postsResponse.error) throw postsResponse.error;
      if (profilesResponse.error) throw profilesResponse.error;
      if (entitiesResponse.error) throw entitiesResponse.error;
      if (personsResponse.error) throw personsResponse.error;

      const posts = postsResponse.data ?? [];
      const profiles = profilesResponse.data ?? [];
      const entities = entitiesResponse.data ?? [];
      const persons = personsResponse.data ?? [];

      // --------- استخراج لیست اهداف از پست‌ها ----------
      const targetMap = new Map<string, TargetItem>();

      posts.forEach((post) => {
        // نهادها
        const postEntities = Array.isArray(post.target_entity)
          ? post.target_entity
          : post.target_entity
          ? [post.target_entity]
          : [];

        postEntities.forEach((entity: any) => {
          let parsedEntity = entity;
          if (typeof entity === 'string') {
            try {
              parsedEntity = JSON.parse(entity);
            } catch {
              parsedEntity = { name_persian: entity };
            }
          }

          const persianName = parsedEntity.name_persian;
          const englishName = parsedEntity.name_english;
          const arabicName = parsedEntity.name_arabic;

          // Use a normalized key so that small differences in spelling/spacing
          // don’t create duplicate cards for the same entity.
          const rawKey = englishName || persianName || arabicName;
          const key = normalize(rawKey);

          if (!key) return;

          if (!targetMap.has(key)) {
            targetMap.set(key, {
              key,
              kind: 'entity',
              name_persian: persianName,
              name_english: englishName,
              name_arabic: arabicName,
              entity_type: parsedEntity.entity_type,
              location: parsedEntity.location,
              postsCount: 0,
              photo_url: null,
              photo_source: null,
              position: parsedEntity.position,
              hasPersianName: !!persianName,
              linkedEntityId: null,
              linkedPersonId: null,
            });
          }

          const existing = targetMap.get(key);
          if (existing) {
            existing.postsCount += 1;
          }
        });

        // اشخاص
        const postPersons = Array.isArray(post.target_persons) ? post.target_persons : [];
        postPersons.forEach((person: any) => {
          let parsedPerson = person;
          if (typeof person === 'string') {
            try {
              parsedPerson = JSON.parse(person);
            } catch {
              parsedPerson = { name_persian: person };
            }
          }

          const persianName = parsedPerson.name_persian;
          const englishName = parsedPerson.name_english;
          const arabicName = parsedPerson.name_arabic;

          // Normalized key to merge slightly different spellings
          const rawKey = englishName || persianName || arabicName;
          const key = normalize(rawKey);

          if (!key) return;

          if (!targetMap.has(key)) {
            targetMap.set(key, {
              key,
              kind: 'person',
              name_persian: persianName,
              name_english: englishName,
              name_arabic: arabicName,
              postsCount: 0,
              photo_url: null,
              photo_source: null,
              position: parsedPerson.position,
              hasPersianName: !!persianName,
              linkedEntityId: null,
              linkedPersonId: null,
            });
          }

          const existing = targetMap.get(key);
          if (existing) {
            existing.postsCount += 1;
          }
        });
      });

      // ---------- مچ کردن با جداول مرجع و پروفایل ----------
      const targetsArray: TargetItem[] = Array.from(targetMap.values()).map((target) => {
        let linkedEntityId: string | null = null;
        let linkedPersonId: string | null = null;
        let canonicalPersian = (target.name_persian || '').trim();

        if (target.kind === 'entity') {
          const te = entities.find((e) => {
            const ep = normalize(e.name_persian);
            const ee = normalize(e.name_english);
            const tp = normalize(target.name_persian);
            const tn = normalize(target.name_english);
            return (ep && (ep === tp || ep === tn)) || (ee && (ee === tp || ee === tn));
          });

          if (te) {
            linkedEntityId = te.id;
            canonicalPersian = (te.name_persian || canonicalPersian).trim();
            if (!target.name_english && te.name_english) {
              target.name_english = te.name_english;
            }
          }
        } else {
          const tp = persons.find((p) => {
            const pp = normalize(p.name_persian);
            const pe = normalize(p.name_english);
            const tp = normalize(target.name_persian);
            const tn = normalize(target.name_english);
            return (pp && (pp === tp || pp === tn)) || (pe && (pe === tp || pe === tn));
          });

          if (tp) {
            linkedPersonId = tp.id;
            canonicalPersian = (tp.name_persian || canonicalPersian).trim();
            if (!target.name_english && tp.name_english) {
              target.name_english = tp.name_english;
            }
          }
        }

        const profile = profiles.find(
          (p) =>
            (p.name_english && target.name_english && p.name_english === target.name_english) ||
            (p.name_persian && target.name_persian && p.name_persian === target.name_persian)
        );

        // ❗ اولویت: پروفایل → جدول مرجع → داده خام پست
        const finalPersianName =
          (profile?.name_persian && profile.name_persian.trim()) ||
          (canonicalPersian && canonicalPersian.trim()) ||
          (target.name_persian && target.name_persian.trim()) ||
          '';

        const hasPersianName = !!finalPersianName;

        return {
          ...target,
          name_persian: finalPersianName,
          linkedEntityId,
          linkedPersonId,
          hasPersianName,
          photo_url: profile?.photo_url ?? target.photo_url,
          photo_source: profile?.photo_source ?? target.photo_source,
        };
      });

      // اولویت نمایش: بدون تصویرها اول
      targetsArray.sort((a, b) => {
        if (!a.photo_url && b.photo_url) return -1;
        if (a.photo_url && !b.photo_url) return 1;
        return 0;
      });

      setTargets(targetsArray);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      toast({ title: 'خطا در بارگذاری اهداف', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchFromWikipedia() {
    const targetsWithoutPhotos = targets.filter((t) => !t.photo_url);

    if (targetsWithoutPhotos.length === 0) {
      toast({ title: 'همه اهداف دارای تصویر هستند', variant: 'default' });
      return;
    }

    setFetching(true);
    setProgress({ current: 0, total: targetsWithoutPhotos.length });

    try {
      console.log(
        `📋 Starting to fetch photos for ${targetsWithoutPhotos.length} targets`,
        targetsWithoutPhotos
      );

      const results = await fetchPhotosForTargets(targetsWithoutPhotos, (current, total) =>
        setProgress({ current, total })
      );

      console.log(`✅ Fetch complete. Got ${results.size} photos from Wikipedia`);
      toast({
        title: `${results.size} تصویر از Wikipedia دریافت و ذخیره شد`,
        variant: 'default',
      });

      await fetchTargets();
    } catch (error) {
      console.error('❌ Failed to fetch from Wikipedia:', error);
      toast({ title: 'خطا در دریافت تصاویر از Wikipedia', variant: 'destructive' });
    } finally {
      setFetching(false);
      setProgress({ current: 0, total: 0 });
    }
  }

  // ---------- upsert دستی روی target_profiles ----------
  async function upsertTargetProfile(target: TargetItem, newName: string) {
    const hasEnglish = !!(target.name_english && target.name_english.trim());
    const identifierValue = hasEnglish
      ? target.name_english!.trim()
      : newName.trim();
    const identifierColumn = hasEnglish ? 'name_english' : 'name_persian';

    if (!identifierValue) return;

    const payload = {
      name_english: target.name_english ?? null,
      name_persian: newName,
      photo_url: target.photo_url ?? null,
      photo_source: target.photo_source ?? null,
    };

    const { data: existing, error: fetchError } = await supabase
      .from('target_profiles')
      .select('id')
      .eq(identifierColumn, identifierValue)
      .maybeSingle();

    if (fetchError) {
      console.error('[PhotoManagement] Failed to fetch target_profile', fetchError);
      throw fetchError;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('target_profiles')
        .update(payload)
        .eq(identifierColumn, identifierValue);

      if (updateError) {
        console.error('[PhotoManagement] Failed to update target_profile', updateError);
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase.from('target_profiles').insert(payload);
      if (insertError) {
        console.error('[PhotoManagement] Failed to insert target_profile', insertError);
        throw insertError;
      }
    }
  }

  const filteredTargets = targets.filter((t) => {
    if (filter === 'with-photo') return !!t.photo_url;
    if (filter === 'without-photo') return !t.photo_url;
    return true;
  });

  const statsWithPhoto = targets.filter((t) => t.photo_url).length;
  const statsWithoutPhoto = targets.filter((t) => !t.photo_url).length;

  const handleSavePersianName = async (target: TargetItem) => {
    const newName = (editPersianNames[target.key] ?? target.name_persian ?? '').trim();
    if (!newName) return;

    setSavingNameId(target.key);

    try {
      if (target.kind === 'entity') {
        let entityId = target.linkedEntityId ?? null;
        const entityType =
          target.entity_type && typeof target.entity_type === 'string'
            ? target.entity_type
            : 'Organization';

        if (entityId) {
          const { error } = await supabase
            .from('resistance_entities')
            .update({ name_persian: newName })
            .eq('id', entityId);
          if (error) throw error;
        } else {
          const { data: existing, error: findError } = await supabase
            .from('resistance_entities')
            .select('id')
            .eq('name_english', target.name_english ?? '')
            .maybeSingle();

          if (findError) throw findError;

          if (existing) {
            entityId = existing.id;
            const { error } = await supabase
              .from('resistance_entities')
              .update({ name_persian: newName })
              .eq('id', entityId);
            if (error) throw error;
          } else {
            const insertPayload: any = {
              name_persian: newName,
              name_english: target.name_english,
              name_arabic: target.name_arabic,
              entity_type: entityType,
              active: true,
            };

            if (target.location && target.location.trim() !== '') {
              insertPayload.location = target.location.trim();
            }

            const { data, error } = await supabase
              .from('resistance_entities')
              .insert(insertPayload)
              .select('id')
              .single();
            if (error) throw error;
            entityId = data.id;
          }
        }

        console.log('[PhotoManagement] Saved entity Persian name', {
          entityId,
          name_persian: newName,
        });

        await upsertTargetProfile(target, newName);

        setTargets((prev) =>
          prev.map((t) =>
            t.key === target.key
              ? {
                  ...t,
                  name_persian: newName,
                  hasPersianName: true,
                  linkedEntityId: entityId,
                  entity_type: entityType,
                }
              : t
          )
        );
      } else {
        let personId = target.linkedPersonId ?? null;

        if (personId) {
          const { error } = await supabase
            .from('resistance_persons')
            .update({ name_persian: newName })
            .eq('id', personId);
          if (error) throw error;
        } else {
          const { data: existing, error: findError } = await supabase
            .from('resistance_persons')
            .select('id')
            .eq('name_english', target.name_english ?? '')
            .maybeSingle();

          if (findError) throw findError;

          if (existing) {
            personId = existing.id;
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
            personId = data.id;
          }
        }

        console.log('[PhotoManagement] Saved person Persian name', {
          personId,
          name_persian: newName,
        });

        await upsertTargetProfile(target, newName);

        setTargets((prev) =>
          prev.map((t) =>
            t.key === target.key
              ? {
                  ...t,
                  name_persian: newName,
                  hasPersianName: true,
                  linkedPersonId: personId,
                }
              : t
          )
        );
      }

      // دوباره از دیتابیس بخوان تا بعد از رفرش هم یکسان باشد
      await fetchTargets();

      toast({ title: 'نام فارسی ذخیره شد', variant: 'default' });
    } catch (error) {
      console.error('Failed to save Persian name', error);
      toast({
        title: 'خطا در ذخیره نام فارسی',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingNameId(null);
    }
  };

  const handleSuggestPersianName = async (target: TargetItem) => {
    const hasAnyName =
      !!(target.name_english && target.name_english.trim()) ||
      !!(target.name_arabic && target.name_arabic.trim()) ||
      !!(target.name_persian && target.name_persian.trim());

    if (!hasAnyName) {
      toast({
        title: 'نام انگلیسی یا عربی یافت نشد',
        description: 'برای پیشنهاد هوشمند حداقل یکی از نام‌های فارسی، انگلیسی یا عربی لازم است.',
        variant: 'destructive',
      });
      return;
    }

    setSuggestingNameId(target.key);

    try {
      console.log('[PhotoManagement] Requesting suggest-target-name', {
        kind: target.kind,
        name_english: target.name_english,
        name_arabic: target.name_arabic,
        name_persian: target.name_persian,
      });

      const { data, error } = await supabase.functions.invoke('suggest-target-name', {
        body: {
          kind: target.kind,
          name_english: target.name_english,
          name_arabic: target.name_arabic,
          name_persian: target.name_persian,
        },
      });

      console.log('[PhotoManagement] suggest-target-name result', { data, error });

      if (error) throw error;

      const suggested = (data?.suggested_persian || '').trim();
      if (suggested) {
        setEditPersianNames((prev) => ({
          ...prev,
          [target.key]: suggested,
        }));
        toast({ title: 'نام پیشنهادی دریافت شد', description: suggested });
      } else {
        toast({ title: 'پیشنهادی دریافت نشد', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to suggest name', error);
      toast({
        title: 'خطا در دریافت پیشنهاد نام',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSuggestingNameId(null);
    }
  };

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

        {/* Progress Bar */}
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
            {filteredTargets.map((target) => (
              <Card key={target.key} className="hover:shadow-lg transition-shadow">
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
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold">
                            {target.name_persian ||
                              target.name_english ||
                              target.name_arabic ||
                              'بدون نام'}
                          </div>
                          {target.name_english && (
                            <div className="text-xs text-muted-foreground">
                              {target.name_english}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline">
                            {target.kind === 'entity' ? 'نهاد' : 'فرد'}
                          </Badge>
                          <Badge variant={target.hasPersianName ? 'default' : 'destructive'}>
                            {target.hasPersianName ? 'نام فارسی ثبت شده' : 'نیازمند ترجمه'}
                          </Badge>
                        </div>
                      </div>

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

                      <div className="mt-3 space-y-2">
                        <label className="text-xs text-muted-foreground">نام فارسی</label>
                        <div className="flex gap-2">
                          <Input
                            value={editPersianNames[target.key] ?? target.name_persian ?? ''}
                            onChange={(e) =>
                              setEditPersianNames((prev) => ({
                                ...prev,
                                [target.key]: e.target.value,
                              }))
                            }
                            placeholder="نام فارسی هدف را وارد کنید"
                            className="text-sm"
                          />
                        </div>
                        <div className="flex gap-2 justify-between">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={suggestingNameId === target.key}
                            onClick={() => handleSuggestPersianName(target)}
                            className="gap-1"
                          >
                            {suggestingNameId === target.key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                            پیشنهاد هوشمند
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            disabled={savingNameId === target.key}
                            onClick={() => handleSavePersianName(target)}
                            className="gap-1"
                          >
                            {savingNameId === target.key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            ذخیره نام فارسی
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
