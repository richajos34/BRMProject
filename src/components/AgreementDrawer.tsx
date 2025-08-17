import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Save, X, FileText, ExternalLink, Calendar, Clock } from 'lucide-react';
import { EventType } from '@/types/calendar';

interface Agreement {
  id: string;
  vendor: string;
  title: string;
  effectiveDate: string;
  endDate: string;
  autoRenew: boolean;
  noticeDays: number;
  status: string;
  fileName?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  vendor: string;
  date: string;
  type: string;
  description?: string;
}

interface AgreementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  agreement?: Agreement | null;
  event?: CalendarEvent | null;
}

export function AgreementDrawer({ isOpen, onClose, agreement, event }: AgreementDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    vendor: agreement?.vendor || event?.vendor || '',
    title: agreement?.title || event?.title || '',
    effectiveDate: agreement?.effectiveDate || '',
    endDate: agreement?.endDate || '',
    autoRenew: agreement?.autoRenew || false,
    noticeDays: agreement?.noticeDays ?? 30,
  });

  const handleSave = () => {
    // Handle save logic here
    console.log('Saving agreement:', formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data
    setFormData({
      vendor: agreement?.vendor || event?.vendor || '',
      title: agreement?.title || event?.title || '',
      effectiveDate: agreement?.effectiveDate || '',
      endDate: agreement?.endDate || '',
      autoRenew: agreement?.autoRenew || false,
      noticeDays: agreement?.noticeDays || 30,
    });
  };

  const calculateOptOutDate = () => {
    if (!formData.endDate || !formData.noticeDays) return '';
    const endDate = new Date(formData.endDate);
    const optOutDate = new Date(endDate);
    optOutDate.setDate(endDate.getDate() - formData.noticeDays);
    return optOutDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'notice':
        return 'bg-red-100 text-red-800';
      case 'renewal':
        return 'bg-blue-100 text-blue-800';
      case 'termination':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader className="pb-6">
          <div className="flex items-center justify-between">
            <SheetTitle>
              {event ? 'Calendar Event Details' : 'Agreement Details'}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {!event && (
                <>
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={handleSave}>
                        <Save size={16} className="mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X size={16} className="mr-2" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Event-specific content */}
          {event && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <Badge className={getEventTypeColor(event.type)}>
                    {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar size={16} />
                  <span>{formatDate(event.date)}</span>
                </div>
                <p>{event.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3>Basic Information</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="vendor">Vendor</Label>
                {isEditing ? (
                  <Input
                    id="vendor"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-sm">{formData.vendor}</p>
                )}
              </div>

              <div>
                <Label htmlFor="title">Agreement Title</Label>
                {isEditing ? (
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-sm">{formData.title}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Term Details */}
          <div className="space-y-4">
            <h3>Term Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="effectiveDate">Effective Date</Label>
                {isEditing ? (
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-sm">{formatDate(formData.effectiveDate)}</p>
                )}
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                {isEditing ? (
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                ) : (
                  <p className="mt-1 text-sm">{formatDate(formData.endDate)}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoRenew">Auto-Renews</Label>
                <p className="text-sm text-muted-foreground">
                  Contract automatically renews unless notice is given
                </p>
              </div>
              {isEditing ? (
                <Switch
                  id="autoRenew"
                  checked={formData.autoRenew}
                  onCheckedChange={(checked: any) => setFormData({ ...formData, autoRenew: checked })}
                />
              ) : (
                <Badge variant={formData.autoRenew ? "default" : "secondary"}>
                  {formData.autoRenew ? "Yes" : "No"}
                </Badge>
              )}
            </div>

            <div>
              <Label htmlFor="noticeDays">Notice Days Required</Label>
              {isEditing ? (
                <Input
                  id="noticeDays"
                  type="number"
                  value={formData.noticeDays}
                  onChange={(e) => setFormData({ ...formData, noticeDays: parseInt(e.target.value) || 0 })}
                />
              ) : (
                <p className="mt-1 text-sm">{formData.noticeDays} days</p>
              )}
            </div>

            {formData.autoRenew && formData.endDate && formData.noticeDays && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={16} className="text-muted-foreground" />
                    <span className="font-medium text-sm">Explicit Opt-Out Date</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Notice must be given by: <span className="font-medium">{calculateOptOutDate()}</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Source Document */}
          {agreement?.fileName && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3>Source Document</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded">
                          <FileText size={20} className="text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{agreement.fileName}</p>
                          <p className="text-xs text-muted-foreground">PDF Document</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <ExternalLink size={16} className="mr-2" />
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}