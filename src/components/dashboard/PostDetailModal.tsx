import React from 'react';
import { X, ExternalLink, Newspaper, User, Calendar, Globe, Tag, Zap, AlertTriangle, Brain, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPersianDate, getRelativeTime } from '@/lib/dateUtils';
import { EnrichedPost } from '@/lib/mockData';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PostDetailModalProps {
  post: EnrichedPost | null;
  isOpen: boolean;
  onClose: () => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, isOpen, onClose }) => {
  if (!post) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0" dir="rtl">
        <DialogHeader className="p-6 pb-4 border-b border-border text-right">
          <DialogTitle className="text-2xl font-bold text-right pr-8">
            {post.title}
          </DialogTitle>
          <button
            onClick={onClose}
            className="absolute left-6 top-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>
        
        {/* Metadata */}
        <div className="px-6 py-4 bg-muted/30 border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">منبع:</span>
              <Badge variant="secondary" className="text-xs">
                <Newspaper className="w-3 h-3 ms-1" />
                {post.source}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">نویسنده:</span>
              <span className="font-medium">
                <User className="w-3 h-3 inline ms-1" />
                {post.author}
              </span>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">تاریخ:</span>
              <div className="text-right">
                <Calendar className="w-3 h-3 inline ms-1" />
                <span className="font-medium">{formatPersianDate(post.date)}</span>
                <p className="text-xs text-muted-foreground">{getRelativeTime(post.date)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">زبان:</span>
              <Badge variant="outline" className="text-xs">
                <Globe className="w-3 h-3 ms-1" />
                {post.language}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">وضعیت:</span>
              <Badge variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 ms-1" />
                {post.status}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <ScrollArea className="h-[50vh] px-6 py-4">
          <div className="prose prose-sm max-w-none text-right" style={{ direction: 'rtl' }}>
            {post.contents.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </ScrollArea>
        
        {/* Keywords */}
        {post.keywords.length > 0 && (
          <div className="px-6 py-4 border-t border-border">
            <h4 className="text-sm font-medium mb-2 text-right">کلمات کلیدی یافت شده:</h4>
            <div className="flex gap-2 flex-wrap justify-end">
              {post.keywords.map((keyword, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Information */}
        {(post as any).analyzed_at && (
          <div className="px-6 py-4 border-t border-border">
            <h3 className="text-sm font-bold mb-3 text-right">اطلاعات تحلیل</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 text-right">نوع تحلیل</div>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  {(post as any).analysis_stage === 'deep' ? (
                    <>
                      <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20">
                        تحلیل عمیق
                      </Badge>
                      <span className="text-xs text-gray-500">
                        25+ فیلد تحلیل شده
                      </span>
                    </>
                  ) : (post as any).analysis_stage === 'quick' ? (
                    <>
                      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20">
                        غربالگری سریع
                      </Badge>
                      <span className="text-xs text-gray-500">
                        فیلدهای اصلی
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 text-right">تاریخ تحلیل</div>
                <div className="text-sm mt-1 text-right">
                  {new Date((post as any).analyzed_at).toLocaleString('fa-IR')}
                </div>
              </div>
              
              {(post as any).analysis_stage === 'quick' && (post as any).is_psyop === false && (
                <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-right">
                      <div className="font-medium text-blue-900 dark:text-blue-100">
                        تحلیل سریع
                      </div>
                      <div className="text-blue-700 dark:text-blue-300 mt-1">
                        این پست به عنوان خبر عادی شناسایی شد و نیاز به تحلیل عمیق نداشت.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {(post as any).analysis_stage === 'deep' && (
                <div className="col-span-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-right">
                      <div className="font-medium text-red-900 dark:text-red-100">
                        تحلیل عمیق
                      </div>
                      <div className="text-red-700 dark:text-red-300 mt-1">
                        این پست به عنوان عملیات روانی احتمالی شناسایی و تحلیل کامل شد.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Show available fields based on analysis stage */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className={(post as any).is_psyop !== null && (post as any).is_psyop !== undefined ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                <span>PsyOp Detection</span>
                <CheckCircle className="w-3 h-3" />
              </div>
              <div className={(post as any).threat_level ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                <span>Threat Level</span>
                <CheckCircle className="w-3 h-3" />
              </div>
              <div className={(post as any).target_entity ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                <span>Target Entity</span>
                <CheckCircle className="w-3 h-3" />
              </div>
              <div className={(post as any).psyop_confidence ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                <span>Confidence Score</span>
                <CheckCircle className="w-3 h-3" />
              </div>
              
              {(post as any).analysis_stage === 'deep' && (
                <>
                  <div className={(post as any).psyop_technique ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                    <span>Techniques</span>
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <div className={(post as any).attack_vectors ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                    <span>Attack Vectors</span>
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <div className={(post as any).narrative_theme ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                    <span>Narrative Theme</span>
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <div className={(post as any).recommended_action ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                    <span>Recommended Response</span>
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <div className={(post as any).key_points ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                    <span>Counter-Narrative</span>
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <div className={(post as any).coordination_indicators ? 'text-green-600 flex items-center gap-1 justify-end' : 'text-gray-400 flex items-center gap-1 justify-end'}>
                    <span>Coordination</span>
                    <CheckCircle className="w-3 h-3" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => window.open(post.articleURL, '_blank')}
          >
            <ExternalLink className="w-4 h-4 ms-2" />
            مشاهده در سایت اصلی
          </Button>
          <Button variant="secondary" disabled>
            تحلیل با هوش مصنوعی (به زودی)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostDetailModal;
