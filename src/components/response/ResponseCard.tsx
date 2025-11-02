import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Radio, Calendar } from 'lucide-react';

interface ResponseCardProps {
  status: 'drafted' | 'under-review' | 'approved' | 'published' | 'monitoring';
  title: string;
  assignedTeam: string[];
  channels: string[];
  publishedDate?: string;
}

const ResponseCard = ({ status, title, assignedTeam, channels, publishedDate }: ResponseCardProps) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'drafted':
        return <Badge variant="secondary">پیش‌نویس</Badge>;
      case 'under-review':
        return <Badge variant="default">در حال بررسی</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">تأیید شده</Badge>;
      case 'published':
        return <Badge className="bg-blue-600">منتشر شده</Badge>;
      case 'monitoring':
        return <Badge className="bg-purple-600">در حال رصد</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">تیم:</span>
          <div className="flex gap-2">
            {assignedTeam.map(member => (
              <Badge key={member} variant="outline">{member}</Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">کانال‌ها:</span>
          <div className="flex gap-2">
            {channels.map(channel => (
              <Badge key={channel} variant="outline">{channel}</Badge>
            ))}
          </div>
        </div>

        {publishedDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">تاریخ انتشار:</span>
            <span>{publishedDate}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm">مشاهده جزئیات</Button>
          <Button variant="outline" size="sm">به‌روزرسانی وضعیت</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResponseCard;
