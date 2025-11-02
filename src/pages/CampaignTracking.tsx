import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Search, Calendar as CalendarIcon, Plus, Shield, CheckCircle, Radar, Sparkles, X } from 'lucide-react';
import { format } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import CampaignCard from '@/components/campaigns/CampaignCard';
import CampaignDetailModal from '@/components/campaigns/CampaignDetailModal';
import { toast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';

const CampaignTracking = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [campaignTypeFilter, setCampaignTypeFilter] = useState<string>('All');
  const [orchestratorFilter, setOrchestratorFilter] = useState<string>('All');
  const [impactRange, setImpactRange] = useState<number[]>([0, 10]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sortBy, setSortBy] = useState<string>('start_date');

  // Fetch campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('psyop_campaigns')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setCampaigns(data || []);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        toast({
          title: "خطا در دریافت داده‌ها",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();

    // Real-time updates
    const channel = supabase
      .channel('campaign-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'psyop_campaigns'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCampaigns(prev => [payload.new, ...prev]);
            toast({
              title: "🎯 کمپین جدید تشخیص داده شد",
              description: payload.new.campaign_name,
            });
          } else if (payload.eventType === 'UPDATE') {
            setCampaigns(prev => 
              prev.map(c => c.id === payload.new.id ? payload.new : c)
            );
          } else if (payload.eventType === 'DELETE') {
            setCampaigns(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(campaign => 
        campaign.campaign_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Campaign type filter
    if (campaignTypeFilter !== 'All') {
      filtered = filtered.filter(c => c.campaign_type === campaignTypeFilter);
    }

    // Orchestrator filter
    if (orchestratorFilter !== 'All') {
      filtered = filtered.filter(c => c.orchestrator === orchestratorFilter);
    }

    // Impact range filter
    filtered = filtered.filter(c => 
      c.impact_assessment >= impactRange[0] && c.impact_assessment <= impactRange[1]
    );

    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter(c => {
        const startDate = new Date(c.start_date);
        return startDate >= dateRange.from! && (!dateRange.to || startDate <= dateRange.to);
      });
    }

    return filtered;
  }, [campaigns, searchQuery, statusFilter, campaignTypeFilter, orchestratorFilter, impactRange, dateRange]);

  // Sort campaigns
  const sortedCampaigns = useMemo(() => {
    const sorted = [...filteredCampaigns];
    
    if (sortBy === 'start_date') {
      sorted.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    } else if (sortBy === 'impact') {
      sorted.sort((a, b) => b.impact_assessment - a.impact_assessment);
    } else if (sortBy === 'status') {
      const statusOrder = { 'Active': 0, 'Monitoring': 1, 'Declining': 2, 'Ended': 3 };
      sorted.sort((a, b) => {
        const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 999;
        const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 999;
        return aOrder - bOrder;
      });
    }
    
    return sorted;
  }, [filteredCampaigns, sortBy]);

  // Quick stats
  const stats = useMemo(() => {
    const active = campaigns.filter(c => c.status === 'Active').length;
    const avgImpact = campaigns.length > 0
      ? (campaigns.reduce((sum, c) => sum + (c.impact_assessment || 0), 0) / campaigns.length).toFixed(1)
      : '0.0';
    const endedThisMonth = campaigns.filter(c => {
      if (!c.end_date) return false;
      const endDate = new Date(c.end_date);
      const now = new Date();
      return endDate.getMonth() === now.getMonth() && endDate.getFullYear() === now.getFullYear();
    }).length;

    return {
      active,
      totalPosts: campaigns.length * 24, // Mock: would come from junction table
      avgImpact,
      endedThisMonth,
    };
  }, [campaigns]);

  const handleCampaignClick = (campaign: any) => {
    setSelectedCampaign(campaign);
    setIsDetailModalOpen(true);
  };

  const handleCreateCampaign = () => {
    toast({
      title: "ایجاد کمپین دستی",
      description: "این ویژگی به زودی اضافه خواهد شد",
    });
  };

  const handleAcceptSuggestion = () => {
    toast({
      title: "کمپین ایجاد شد",
      description: "کمپین پیشنهادی با موفقیت ایجاد شد",
    });
    setShowAISuggestion(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Radar className="h-8 w-8 text-primary" />
            رصد کمپین‌ها
          </h1>
          <p className="text-muted-foreground mt-1">
            شناسایی و پیگیری کمپین‌های هماهنگ جنگ روانی
          </p>
        </div>
        <Button className="gap-2" onClick={handleCreateCampaign}>
          <Plus className="h-4 w-4" />
          ایجاد کمپین دستی
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center bg-danger/5 border-danger">
          <div className="text-3xl font-bold text-danger">{stats.active}</div>
          <div className="text-sm text-muted-foreground">کمپین فعال</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{stats.totalPosts}</div>
          <div className="text-sm text-muted-foreground">مجموع مطالب</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-orange-600">{stats.avgImpact}</div>
          <div className="text-sm text-muted-foreground">میانگین تاثیر</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-muted-foreground">{stats.endedThisMonth}</div>
          <div className="text-sm text-muted-foreground">پایان یافته این ماه</div>
        </Card>
      </div>

      {/* AI Suggestion */}
      {showAISuggestion && (
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">
                کمپین بالقوه جدید تشخیص داده شد
              </h3>
              <p className="text-muted-foreground mb-3">
                سیستم هوش مصنوعی یک الگوی کمپین هماهنگ را شناسایی کرده است
              </p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <span className="text-sm text-muted-foreground">نام پیشنهادی:</span>
                  <div className="font-medium">کمپین تخریب اعتبار</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">مطالب مرتبط:</span>
                  <div className="font-medium">18 مطلب</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">شباهت:</span>
                  <div className="font-medium">87%</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAcceptSuggestion}>
                  ایجاد کمپین
                </Button>
                <Button variant="outline" onClick={() => setShowAISuggestion(false)}>
                  رد کردن
                </Button>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowAISuggestion(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="جستجو در نام کمپین‌ها..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {['All', 'Active', 'Monitoring', 'Declining', 'Ended'].map(status => (
            <Badge
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer',
                status === 'Active' && statusFilter === status && 'bg-danger animate-pulse'
              )}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'All' ? 'همه' : status}
            </Badge>
          ))}
        </div>

        {/* More Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={campaignTypeFilter} onValueChange={setCampaignTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="نوع کمپین" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">همه انواع</SelectItem>
              <SelectItem value="Coordinated Attack">حمله هماهنگ</SelectItem>
              <SelectItem value="Disinformation Wave">موج اطلاعات نادرست</SelectItem>
              <SelectItem value="Character Assassination">ترور شخصیت</SelectItem>
              <SelectItem value="Strategic Narrative">روایت استراتژیک</SelectItem>
            </SelectContent>
          </Select>

          <Select value={orchestratorFilter} onValueChange={setOrchestratorFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="سازماندهی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">همه</SelectItem>
              <SelectItem value="Israel">اسرائیل</SelectItem>
              <SelectItem value="USA">آمریکا</SelectItem>
              <SelectItem value="Saudi">عربستان</SelectItem>
              <SelectItem value="UAE">امارات</SelectItem>
              <SelectItem value="Western Media">رسانه غربی</SelectItem>
              <SelectItem value="Unknown">نامشخص</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-60">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'PP', { locale: faIR })} -{' '}
                      {format(dateRange.to, 'PP', { locale: faIR })}
                    </>
                  ) : (
                    format(dateRange.from, 'PP', { locale: faIR })
                  )
                ) : (
                  <span>بازه زمانی</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <div className="flex-1 flex items-center gap-3 min-w-[200px]">
            <span className="text-sm text-muted-foreground whitespace-nowrap">تاثیر:</span>
            <Slider
              value={impactRange}
              onValueChange={setImpactRange}
              min={0}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-medium min-w-[50px]">
              {impactRange[0]} - {impactRange[1]}
            </span>
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="مرتب‌سازی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start_date">تاریخ شروع</SelectItem>
              <SelectItem value="impact">میزان تاثیر</SelectItem>
              <SelectItem value="status">وضعیت</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campaigns Grid */}
      {sortedCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="relative">
            <Shield className="h-24 w-24 text-success/30" />
            <CheckCircle className="h-12 w-12 text-success absolute bottom-0 right-0" />
          </div>
          <h3 className="text-2xl font-semibold text-center">
            هیچ کمپین هماهنگی در حال حاضر تشخیص داده نشده
          </h3>
          <p className="text-muted-foreground text-center">
            سیستم در حال تحلیل {campaigns.length} کمپین برای شناسایی الگوها است
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCampaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={() => handleCampaignClick(campaign)}
              onEdit={() => {
                toast({
                  title: "ویرایش کمپین",
                  description: "این ویژگی به زودی اضافه خواهد شد",
                });
              }}
              onArchive={() => {
                toast({
                  title: "آرشیو کمپین",
                  description: "این ویژگی به زودی اضافه خواهد شد",
                });
              }}
              onDelete={() => {
                toast({
                  title: "حذف کمپین",
                  description: "این ویژگی به زودی اضافه خواهد شد",
                });
              }}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaign}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </div>
  );
};

export default CampaignTracking;
