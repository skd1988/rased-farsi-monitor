import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Filter, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserFiltersProps {
  selectedRoles: string[];
  setSelectedRoles: (roles: string[]) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  dateFilter: string;
  setDateFilter: (filter: string) => void;
  customDateRange: { from?: Date; to?: Date };
  setCustomDateRange: (range: { from?: Date; to?: Date }) => void;
}

export const UserFilters: React.FC<UserFiltersProps> = ({
  selectedRoles,
  setSelectedRoles,
  selectedStatus,
  setSelectedStatus,
  dateFilter,
  setDateFilter,
  customDateRange,
  setCustomDateRange,
}) => {
  const roleOptions = [
    { value: 'super_admin', label: 'Super Admin', badge: 'محدود' },
    { value: 'admin', label: 'Admin' },
    { value: 'analyst', label: 'Analyst' },
    { value: 'viewer', label: 'Viewer' },
    { value: 'guest', label: 'Guest' },
  ];

  const handleRoleToggle = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Role Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            نقش {selectedRoles.length > 0 && `(${selectedRoles.length})`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="end">
          <div className="space-y-2">
            <h4 className="font-medium text-sm mb-2">انتخاب نقش</h4>
            {roleOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id={option.value}
                  checked={selectedRoles.includes(option.value)}
                  onCheckedChange={() => handleRoleToggle(option.value)}
                />
                <label
                  htmlFor={option.value}
                  className="text-sm flex-1 cursor-pointer flex items-center gap-2"
                >
                  {option.label}
                  {option.badge && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                      {option.badge}
                    </span>
                  )}
                </label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Status Filter */}
      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="وضعیت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">همه</SelectItem>
          <SelectItem value="active">فعال</SelectItem>
          <SelectItem value="suspended">معلق</SelectItem>
          <SelectItem value="inactive">غیرفعال</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Filter */}
      <Select value={dateFilter} onValueChange={setDateFilter}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="عضویت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">همه</SelectItem>
          <SelectItem value="today">امروز</SelectItem>
          <SelectItem value="week">این هفته</SelectItem>
          <SelectItem value="month">این ماه</SelectItem>
          <SelectItem value="custom">سفارشی</SelectItem>
        </SelectContent>
      </Select>

      {/* Custom Date Range Picker */}
      {dateFilter === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-2", !customDateRange.from && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4" />
              {customDateRange.from ? (
                customDateRange.to ? (
                  <>
                    {format(customDateRange.from, "yyyy/MM/dd")} - {format(customDateRange.to, "yyyy/MM/dd")}
                  </>
                ) : (
                  format(customDateRange.from, "yyyy/MM/dd")
                )
              ) : (
                "انتخاب تاریخ"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{
                from: customDateRange.from,
                to: customDateRange.to,
              }}
              onSelect={(range) => {
                setCustomDateRange({
                  from: range?.from,
                  to: range?.to,
                });
              }}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};