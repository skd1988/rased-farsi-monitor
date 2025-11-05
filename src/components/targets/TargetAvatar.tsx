import { useState } from 'react';
import { User, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/photoFetcher';
import { toast } from 'sonner';

interface TargetAvatarProps {
  target: {
    name_english?: string;
    name_persian?: string;
    name_arabic?: string;
    photo_url?: string;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showUpload?: boolean;
  onPhotoUpdate?: (url: string) => void;
}

const sizeClasses = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-24 h-24 text-4xl',
  xl: 'w-32 h-32 text-5xl'
};

export function TargetAvatar({ 
  target, 
  size = 'md', 
  showUpload = false,
  onPhotoUpdate 
}: TargetAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const name = target.name_persian || target.name_english || target.name_arabic || '';
  const initial = name[0]?.toUpperCase() || '?';
  
  // Generate consistent gradient based on name
  const gradient = generateGradient(name);
  
  async function handleFileUpload(file: File) {
    if (!file) return;
    
    setUploading(true);
    
    try {
      // Compress image first
      const compressed = await compressImage(file);
      
      // Upload to Supabase Storage - use timestamp-only for URL-safe filename
      const fileName = `target-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('target-photos')
        .upload(fileName, compressed, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('target-photos')
        .getPublicUrl(fileName);
      
      // Update target profile
      const { error: upsertError } = await supabase
        .from('target_profiles')
        .upsert({
          name_persian: target.name_persian || target.name_english || target.name_arabic || 'نامشخص',
          name_english: target.name_english || null,
          name_arabic: target.name_arabic || null,
          photo_url: publicUrl,
          photo_source: 'manual'
        }, {
          onConflict: 'name_persian'
        });
      
      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }
      
      // Reset error state and call callback
      setImageError(false);
      if (onPhotoUpdate) {
        onPhotoUpdate(publicUrl);
      }
      
      toast.success('تصویر با موفقیت آپلود شد');
      
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('خطا در آپلود تصویر');
    } finally {
      setUploading(false);
    }
  }
  
  return (
    <div className="relative group">
      {/* Avatar */}
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden relative`}>
        {target.photo_url && !imageError ? (
          <>
            <img
              src={target.photo_url}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
            {/* Overlay on hover */}
            {showUpload && (
              <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <label className="cursor-pointer">
                  <User className="w-6 h-6 text-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </label>
              </div>
            )}
          </>
        ) : (
          <div className={`
            w-full h-full bg-gradient-to-br ${gradient}
            flex items-center justify-center text-white font-bold
            ${showUpload ? 'cursor-pointer' : ''}
          `}>
            {uploading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                {initial}
                {showUpload && (
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/30 transition-opacity">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Upload button for admins */}
      {showUpload && !uploading && (
        <label
          className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <Upload className="w-3 h-3" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

function generateGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const gradients = [
    'from-red-500 to-rose-600',
    'from-orange-500 to-amber-600',
    'from-yellow-500 to-orange-500',
    'from-green-500 to-emerald-600',
    'from-teal-500 to-cyan-600',
    'from-blue-500 to-indigo-600',
    'from-indigo-500 to-purple-600',
    'from-purple-500 to-pink-600',
    'from-pink-500 to-rose-600',
    'from-gray-600 to-gray-800'
  ];
  
  return gradients[Math.abs(hash) % gradients.length];
}
