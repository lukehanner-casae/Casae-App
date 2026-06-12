import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FITOUT_CATEGORIES, useCreateFitoutItem, useFitoutItems } from '@/hooks/use-fitout'
import { formatAud, formatDate, todayIso } from '@/lib/format'
import { paybackWeeks, propertyMetrics } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import type { PropertyWithRooms } from '@/lib/types'

function AddFitoutDialog({ propertyId }: { propertyId: string }) {
  const createItem = useCreateFitoutItem()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [cost, setCost] = useState('')
  const [category, setCategory] = useState('furniture')
  const [purchaseDate, setPurchaseDate] = useState(todayIso())
  const [file, setFile] = useState<File | null>(null)

  const submit = () => {
    if (!description.trim() || !cost) {
      toast.error('Description and cost are required')
      return
    }
    if (file && file.size > 10 * 1024 * 1024) {
      toast.error('Receipt must be 10MB or less')
      return
    }
    createItem.mutate(
      {
        item: {
          property_id: propertyId,
          description: description.trim(),
          cost: Number(cost),
          category,
          purchase_date: purchaseDate || null,
        },
        receiptFile: file,
      },
      {
        onSuccess: () => {
          toast.success('Fitout item logged')
          setOpen(false)
          setDescription('')
          setCost('')
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
          <Plus className="h-4 w-4" /> Log item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Log fitout item
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fitout-desc">Description</Label>
            <Input
              id="fitout-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Queen bed frame x2"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fitout-cost">Cost (AUD)</Label>
            <Input
              id="fitout-cost"
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FITOUT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fitout-date">Purchase date</Label>
            <Input
              id="fitout-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fitout-receipt">Receipt (JPEG / PNG / PDF, max 10MB)</Label>
            <Input
              id="fitout-receipt"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={createItem.isPending}
          >
            {createItem.isPending ? 'Saving…' : 'Log item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function FitoutPanel({
  property,
}: {
  property: PropertyWithRooms
}) {
  const { data: items, isLoading } = useFitoutItems(property.id)
  const metrics = propertyMetrics(property)
  const total = (items ?? []).reduce((s, i) => s + (i.cost ?? 0), 0)
  const payback = paybackWeeks(total, metrics.margin)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total fitout spend', value: formatAud(total) },
          { label: 'Weekly margin', value: formatAud(metrics.margin) },
          {
            label: 'Payback period',
            value: payback == null ? '—' : `${payback} wks`,
          },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 text-center">
              <p className="font-body text-xs text-muted-foreground">{label}</p>
              <p className="font-heading text-2xl font-semibold text-navy">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <AddFitoutDialog propertyId={property.id} />
      </div>

      <div className="rounded-md border border-stone bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="hidden sm:table-cell">Category</TableHead>
              <TableHead className="hidden sm:table-cell">Purchased</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No fitout items logged.
                </TableCell>
              </TableRow>
            ) : (
              (items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-navy">
                    <span className="flex items-center gap-1.5">
                      {item.description}
                      {item.receipt_url ? (
                        <Receipt
                          className="h-3.5 w-3.5 text-sage"
                          aria-label="Receipt attached"
                        />
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn('hidden capitalize sm:table-cell')}
                  >
                    {item.category ?? '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {formatDate(item.purchase_date)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAud(item.cost)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
