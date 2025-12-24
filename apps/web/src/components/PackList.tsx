import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Plus, Trash2, Save, CheckCircle } from 'lucide-react';

export interface PackListItem {
  id: string;
  name: string;
  packed: boolean;
  category: 'documents' | 'medications' | 'clothing' | 'toiletries' | 'medical_equipment' | 'other';
  priority: 'essential' | 'important' | 'optional';
  notes?: string;
  quantity?: string;
}

export interface PackListData {
  careRecipientId: string;
  items: PackListItem[];
  lastVerifiedAt: Date | null;
  lastVerifiedBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface PackListProps {
  careRecipientId: string;
  initialData?: PackListData;
  onSave: (items: PackListItem[]) => Promise<void>;
  onVerify?: () => Promise<void>;
  readOnly?: boolean;
  className?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'documents', label: 'Documents', emoji: '📄' },
  { value: 'medications', label: 'Medications', emoji: '💊' },
  { value: 'clothing', label: 'Clothing', emoji: '👕' },
  { value: 'toiletries', label: 'Toiletries', emoji: '🧴' },
  { value: 'medical_equipment', label: 'Medical Equipment', emoji: '🩺' },
  { value: 'other', label: 'Other', emoji: '📦' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'essential', label: 'Essential', color: 'text-red-600 bg-red-50' },
  { value: 'important', label: 'Important', color: 'text-orange-600 bg-orange-50' },
  { value: 'optional', label: 'Optional', color: 'text-blue-600 bg-blue-50' },
] as const;

const TEMPLATE_ITEMS: Omit<PackListItem, 'id'>[] = [
  // Based on Daily Care Report Template (Page 14: Hospital Bag Preparedness)
  { name: 'Kaftans/loose front-button clothes', packed: false, category: 'clothing', priority: 'essential', quantity: '2' },
  { name: 'Panties', packed: false, category: 'clothing', priority: 'essential', quantity: '2' },
  { name: 'Diapers', packed: false, category: 'clothing', priority: 'essential', quantity: '2' },
  { name: 'Comfortable footwear', packed: false, category: 'clothing', priority: 'essential' },
  { name: 'Small towel', packed: false, category: 'toiletries', priority: 'essential' },
  { name: 'Large towel', packed: false, category: 'toiletries', priority: 'essential' },
  { name: 'Hairbrush', packed: false, category: 'toiletries', priority: 'essential' },
  { name: 'Toothbrush & toothpaste', packed: false, category: 'toiletries', priority: 'essential' },
];

export function PackList({
  careRecipientId: _careRecipientId,
  initialData,
  onSave,
  onVerify,
  readOnly = false,
  className = '',
}: PackListProps) {
  const [items, setItems] = useState<PackListItem[]>(initialData?.items || []);
  const [newItemName, setNewItemName] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(initialData?.updatedAt || null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Initialize with templates if no items exist
  useEffect(() => {
    if (!initialData?.items || initialData.items.length === 0) {
      setShowTemplates(true);
    }
  }, [initialData]);

  const addItem = (name: string, category: PackListItem['category'], priority: PackListItem['priority'], quantity?: string) => {
    const newItem: PackListItem = {
      id: crypto.randomUUID(),
      name,
      packed: false,
      category,
      priority,
      quantity,
    };
    setItems([...items, newItem]);
    setNewItemName('');
    setIsAddingItem(false);
  };

  // Template functionality for future use
  // const addFromTemplate = (templateItem: Omit<PackListItem, 'id'>) => {
  //   const newItem: PackListItem = {
  //     ...templateItem,
  //     id: crypto.randomUUID(),
  //   };
  //   setItems([...items, newItem]);
  // };

  const addAllTemplates = () => {
    // Filter out templates that already exist (by name)
    const existingNames = new Set(items.map(item => item.name.toLowerCase()));
    const newTemplates = TEMPLATE_ITEMS.filter(
      template => !existingNames.has(template.name.toLowerCase())
    );

    const newItems = newTemplates.map(item => ({
      ...item,
      id: crypto.randomUUID(),
    }));

    setItems([...items, ...newItems]);
    setShowTemplates(false);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const togglePacked = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, packed: !item.packed } : item
    ));
  };

  // Update functionality for future use
  // const updateItem = (id: string, updates: Partial<PackListItem>) => {
  //   setItems(items.map(item =>
  //     item.id === id ? { ...item, ...updates } : item
  //   ));
  // };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(items);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save pack list:', error);
      alert('Failed to save hospital bag. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    if (onVerify) {
      try {
        await onVerify();
        alert('Hospital bag verified successfully!');
      } catch (error) {
        console.error('Failed to verify pack list:', error);
        alert('Failed to verify hospital bag. Please try again.');
      }
    }
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PackListItem[]>);

  const packedCount = items.filter(item => item.packed).length;
  const progressPercentage = items.length > 0 ? (packedCount / items.length) * 100 : 0;

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Hospital Bag Preparedness</h2>
              <p className="text-sm text-gray-600 mt-1">
                One-time setup - Update as needed when items change
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                Packed: {packedCount} / {items.length}
              </div>
              <div className="w-32 h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {lastSaved && (
            <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Last saved: {new Date(lastSaved).toLocaleString()}
            </div>
          )}

          {initialData?.lastVerifiedAt && (
            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Last verified: {new Date(initialData.lastVerifiedAt).toLocaleString()}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Template Selection */}
          {showTemplates && items.length === 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Quick Start</h3>
              <p className="text-sm text-blue-800 mb-3">
                Get started quickly with our pre-filled template of essential items, or create your own list from scratch.
              </p>
              <div className="flex gap-2">
                <Button onClick={addAllTemplates} className="bg-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Use Template ({TEMPLATE_ITEMS.length} items)
                </Button>
                <Button onClick={() => setShowTemplates(false)} variant="outline">
                  Start from Scratch
                </Button>
              </div>
            </div>
          )}

          {/* Items by Category */}
          {CATEGORY_OPTIONS.map(category => {
            const categoryItems = groupedItems[category.value] || [];
            if (categoryItems.length === 0) return null;

            return (
              <div key={category.value} className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">{category.emoji}</span>
                  <span>{category.label}</span>
                  <span className="text-sm text-gray-500">
                    ({categoryItems.filter(i => i.packed).length}/{categoryItems.length})
                  </span>
                </h3>

                <div className="space-y-2">
                  {categoryItems.map(item => {
                    const priorityStyle = PRIORITY_OPTIONS.find(p => p.value === item.priority);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          item.packed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.packed}
                          onChange={() => !readOnly && togglePacked(item.id)}
                          disabled={readOnly}
                          className="mt-1 w-5 h-5 rounded border-gray-300"
                        />

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${item.packed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                              {item.name}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${priorityStyle?.color}`}>
                              {priorityStyle?.label}
                            </span>
                          </div>

                          {item.quantity && (
                            <div className="text-sm text-gray-600 mt-1">
                              Quantity: {item.quantity}
                            </div>
                          )}

                          {item.notes && (
                            <div className="text-sm text-gray-600 mt-1">
                              Note: {item.notes}
                            </div>
                          )}
                        </div>

                        {!readOnly && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {items.length === 0 && !showTemplates && (
            <div className="text-center py-8 text-gray-500">
              <p>No items in the hospital bag yet.</p>
              <p className="text-sm mt-2">Add items below or use the template to get started.</p>
            </div>
          )}

          {/* Add New Item */}
          {!readOnly && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              {!isAddingItem ? (
                <div className="flex gap-2">
                  <Button onClick={() => setIsAddingItem(true)} variant="outline" className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>

                  {items.length === 0 && !showTemplates && (
                    <Button onClick={() => setShowTemplates(true)} variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Use Template
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Item name (e.g., Spare glasses)"
                    className="w-full"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <select className="px-3 py-2 border border-gray-300 rounded-md">
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.emoji} {cat.label}
                        </option>
                      ))}
                    </select>

                    <select className="px-3 py-2 border border-gray-300 rounded-md">
                      {PRIORITY_OPTIONS.map(pri => (
                        <option key={pri.value} value={pri.value}>
                          {pri.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => addItem(newItemName, 'other', 'optional')}
                      disabled={!newItemName.trim()}
                      className="flex-1"
                    >
                      Add Item
                    </Button>
                    <Button onClick={() => {
                      setIsAddingItem(false);
                      setNewItemName('');
                    }} variant="outline">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!readOnly && items.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Hospital Bag'}
              </Button>

              {onVerify && (
                <Button onClick={handleVerify} variant="outline">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Verified
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
