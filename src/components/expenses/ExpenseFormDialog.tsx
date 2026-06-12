import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/auth/AuthProvider'
import { useProperties } from '@/hooks/use-properties'
import { EXPENSE_CATEGORIES, useCreateExpense } from '@/hooks/use-expenses'
import { todayIso } from '@/lib/format'

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

export default function ExpenseFormDialog() {
  const { user } = useAuth()
  const { data: properties } = useProperties()
  const createExpense = useCreateExpense()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const submit = () => {
    if (!propertyId || !amount || !category) {
      toast.error('Property, amount and category are required')
      return
    }
    if (file && file.size > MAX_RECEIPT_BYTES) {
      toast.error('Receipt must be 10MB or less')
      return
    }
    createExpense.mutate(
      {
        expense: {
          property_id: propertyId,
          amount: Number(amount),
          expense_date: date,
          category,
          description: description.trim() || null,
          created_by: user?.id ?? null,
        },
        receiptFile: file,
      },
      {
        onSuccess: () => {
          toast.success('Expense logged')
          setOpen(false)
          setAmount('')
          setDescription('')
          setFile(null)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Log expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Log expense
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {(properties ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-amount">Amount (AUD)</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Description</Label>
            <Textarea
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-receipt">
              Receipt (JPEG / PNG / PDF, max 10MB)
            </Label>
            <Input
              id="exp-receipt"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={createExpense.isPending}
          >
            {createExpense.isPending ? 'Saving…' : 'Log expense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
