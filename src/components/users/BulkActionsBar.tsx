import React from 'react';
import { Button } from '@/components/ui/button';
import { Ban, Trash, X, Edit } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onAction: (action: 'suspend' | 'delete' | 'changeStatus') => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onClear,
  onAction,
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-card border shadow-lg rounded-lg p-4 flex items-center gap-4 min-w-[400px]">
        <span className="text-sm font-medium">
          {selectedCount} کاربر انتخاب شده
        </span>
        
        <div className="flex-1 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('changeStatus')}
          >
            <Edit className="ml-2 h-4 w-4" />
            تغییر وضعیت
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            className="text-orange-600 hover:text-orange-700"
            onClick={() => onAction('suspend')}
          >
            <Ban className="ml-2 h-4 w-4" />
            تعلیق همگی
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onAction('delete')}
          >
            <Trash className="ml-2 h-4 w-4" />
            حذف همگی
          </Button>
        </div>
        
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="ml-2 h-4 w-4" />
          لغو
        </Button>
      </div>
    </div>
  );
};