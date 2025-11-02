import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, TrendingUp } from 'lucide-react';

interface TemplateCardProps {
  title: string;
  category: string;
  usageCount: number;
  lastUsed: string;
}

const TemplateCard = ({ title, category, usageCount, lastUsed }: TemplateCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <FileText className="w-8 h-8 text-primary" />
          <Badge variant="outline">{category}</Badge>
        </div>
        <CardTitle className="text-lg mt-2">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">استفاده شده:</span>
            <span className="font-semibold">{usageCount} بار</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">آخرین استفاده:</span>
          <span>{lastUsed}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1">استفاده از قالب</Button>
          <Button variant="outline" size="sm">مشاهده</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TemplateCard;
