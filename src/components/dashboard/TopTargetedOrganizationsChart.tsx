import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, TrendingUp } from 'lucide-react';
import { TargetAvatar } from '@/components/targets/TargetAvatar';

interface OrganizationData {
  name_persian: string;
  name_english?: string;
  name_arabic?: string;
  photo_url?: string;
  count: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  percentage: number;
}

interface TopTargetedOrganizationsChartProps {
  data: OrganizationData[];
  onOrgClick?: (org: string) => void;
}

const TopTargetedOrganizationsChart: React.FC<TopTargetedOrganizationsChartProps> = ({ 
  data, 
  onOrgClick 
}) => {
  const severityColors = {
    Critical: '#DC2626',
    High: '#EA580C',
    Medium: '#EAB308',
    Low: '#22C55E',
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          سازمان‌های تحت حمله
        </CardTitle>
        <CardDescription>
          10 نهاد برتر مورد هدف در حملات جنگ روانی
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>هیچ سازمانی شناسایی نشده</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top 3 with avatars */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {data.slice(0, 3).map((org, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => onOrgClick?.(org.name_english || org.name_persian)}
                >
                  <div className="relative mb-2">
                    <TargetAvatar
                      target={{
                        name_persian: org.name_persian,
                        name_english: org.name_english,
                        name_arabic: org.name_arabic,
                        photo_url: org.photo_url
                      }}
                      size={idx === 0 ? 'lg' : 'md'}
                      showUpload={false}
                    />
                    {idx === 0 && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        1
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-sm truncate max-w-full">
                      {org.name_persian}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {org.count} حمله
                    </div>
                    <div className={`text-xs font-medium mt-1 ${
                      org.severity === 'Critical' ? 'text-red-600' :
                      org.severity === 'High' ? 'text-orange-600' :
                      org.severity === 'Medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {org.severity === 'Critical' ? 'بحرانی' :
                       org.severity === 'High' ? 'بالا' :
                       org.severity === 'Medium' ? 'متوسط' : 'پایین'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bar chart for all */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 120, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name_persian" 
                  type="category" 
                  width={110}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload as OrganizationData;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3">
                          <div className="font-bold mb-1">{data.name_persian}</div>
                          {data.name_english && (
                            <div className="text-xs text-muted-foreground mb-2">
                              {data.name_english}
                            </div>
                          )}
                          <div className="text-sm space-y-1">
                            <div>حملات: <span className="font-bold">{data.count}</span></div>
                            <div>درصد: <span className="font-bold">{data.percentage.toFixed(1)}%</span></div>
                            <div>شدت: 
                              <span className={`font-bold mr-1 ${
                                data.severity === 'Critical' ? 'text-red-600' :
                                data.severity === 'High' ? 'text-orange-600' :
                                data.severity === 'Medium' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {data.severity === 'Critical' ? 'بحرانی' :
                                 data.severity === 'High' ? 'بالا' :
                                 data.severity === 'Medium' ? 'متوسط' : 'پایین'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="count" 
                  radius={[0, 4, 4, 0]}
                  onClick={(data) => onOrgClick?.(data.name_english || data.name_persian)}
                  className="cursor-pointer"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={severityColors[entry.severity]}
                      opacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Statistics */}
            <div className="flex items-center justify-between pt-4 border-t text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                <span>مجموع حملات: {data.reduce((sum, o) => sum + o.count, 0)}</span>
              </div>
              <div className="text-muted-foreground">
                {data.length} سازمان مورد هدف
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopTargetedOrganizationsChart;
