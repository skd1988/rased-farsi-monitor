import React from 'react';
import { X, ExternalLink, Newspaper, User, Calendar, Globe, Tag } from 'lucide-react';
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
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
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
                <Newspaper className="w-3 h-3 ml-1" />
                {post.source}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">نویسنده:</span>
              <span className="font-medium">
                <User className="w-3 h-3 inline ml-1" />
                {post.author}
              </span>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">تاریخ:</span>
              <div className="text-right">
                <Calendar className="w-3 h-3 inline ml-1" />
                <span className="font-medium">{formatPersianDate(post.date)}</span>
                <p className="text-xs text-muted-foreground">{getRelativeTime(post.date)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">زبان:</span>
              <Badge variant="outline" className="text-xs">
                <Globe className="w-3 h-3 ml-1" />
                {post.language}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <span className="text-muted-foreground">وضعیت:</span>
              <Badge variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 ml-1" />
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
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => window.open(post.articleURL, '_blank')}
          >
            <ExternalLink className="w-4 h-4 ml-2" />
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
