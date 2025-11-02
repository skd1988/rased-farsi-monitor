import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { faIR } from 'date-fns/locale';

interface Note {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

interface NotesSectionProps {
  notes: Note[];
  onAddNote: (content: string) => void;
}

const NotesSection: React.FC<NotesSectionProps> = ({ notes, onAddNote }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  const handleSave = () => {
    if (noteContent.trim()) {
      onAddNote(noteContent);
      setNoteContent('');
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">یادداشت‌ها و نظرات</h3>
          <Badge variant="secondary">{notes.length}</Badge>
        </div>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 ml-2" />
            افزودن یادداشت
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Textarea
              placeholder="یادداشت خود را بنویسید... (برای تگ کردن از @username استفاده کنید)"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm">
                ذخیره
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNoteContent('');
                }}
              >
                لغو
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-sm">{note.author}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(note.timestamp), 'PPp', { locale: faIR })}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
            </CardContent>
          </Card>
        ))}
        {notes.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            هنوز یادداشتی اضافه نشده است
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesSection;
