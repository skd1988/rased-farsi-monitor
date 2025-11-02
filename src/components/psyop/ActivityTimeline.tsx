import React from 'react';
import { format } from 'date-fns';
import { faIR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Circle } from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'detected' | 'status_change' | 'assigned' | 'note' | 'resolved';
  timestamp: string;
  user?: string;
  details: string;
  status?: string;
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events }) => {
  const getEventIcon = (type: string) => {
    const colors = {
      detected: 'text-primary',
      status_change: 'text-blue-600',
      assigned: 'text-purple-600',
      note: 'text-green-600',
      resolved: 'text-success',
    };
    return colors[type as keyof typeof colors] || 'text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Circle className={`h-3 w-3 ${getEventIcon(event.type)} fill-current`} />
            {index < events.length - 1 && (
              <div className="w-px h-full bg-border mt-1" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{event.details}</span>
              {event.status && (
                <Badge variant="outline" className="text-xs">
                  {event.status}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {event.user && <span className="font-medium">{event.user}</span>}
              {event.user && ' • '}
              {format(new Date(event.timestamp), 'PPp', { locale: faIR })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityTimeline;
