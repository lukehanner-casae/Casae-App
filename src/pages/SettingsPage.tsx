import { useState } from 'react'
import { toast } from 'sonner'
import { Link2, Mail, Send } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/auth/AuthProvider'
import { useProfiles, useUpdateProfile } from '@/hooks/use-profiles'
import { useProperties } from '@/hooks/use-properties'
import { useAppSetting, useSetAppSetting } from '@/hooks/use-settings'
import {
  TRACKING_MAP_KEY,
  useXeroConnection,
  useXeroDisconnect,
  useXeroTrackingCategories,
  useXeroTrackingMap,
} from '@/hooks/use-xero'
import { supabase } from '@/lib/supabase'
import { XERO_STATE_STORAGE_KEY, type XeroTrackingMap } from '@/lib/xero'

function AccountSection() {
  const { user } = useAuth()
  const { data: profiles } = useProfiles()
  const updateProfile = useUpdateProfile()
  const myProfile = profiles?.find((p) => p.id === user?.id)

  // null = untouched, falls back to the loaded profile value.
  const [displayNameInput, setDisplayNameInput] = useState<string | null>(null)
  const displayName = displayNameInput ?? myProfile?.display_name ?? ''
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const saveDisplayName = () => {
    if (!user || !displayName.trim()) {
      toast.error('Display name is required')
      return
    }
    updateProfile.mutate(
      { id: user.id, display_name: displayName.trim() },
      {
        onSuccess: () => toast.success('Display name updated'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const changePassword = async () => {
    if (!user?.email) return
    if (!currentPassword || !newPassword) {
      toast.error('Current and new password are required')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setChangingPassword(true)
    try {
      // Supabase updateUser doesn't verify the old password, so re-authenticate first.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) {
        toast.error('Current password is incorrect')
        return
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Password changed')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-2xl text-navy">
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ''} readOnly disabled />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="e.g. Luke"
            />
            <Button
              variant="secondary"
              onClick={saveDisplayName}
              disabled={updateProfile.isPending}
            >
              Save
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-heading text-lg font-semibold text-navy">
            Change password
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="current-pw">Current password</Label>
            <Input
              id="current-pw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={changePassword} disabled={changingPassword}>
            {changingPassword ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** Match each Xero tracking category option to a property in the app. */
function XeroTrackingMapConfig() {
  const { data, isLoading, error } = useXeroTrackingCategories(true)
  const { data: savedMap } = useXeroTrackingMap()
  const { data: properties } = useProperties()
  const setSetting = useSetAppSetting()

  // null = untouched, falls back to the saved map / first active category.
  const [categoryInput, setCategoryInput] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }
  if (error) {
    return (
      <p className="font-body text-sm text-destructive">
        Couldn't load tracking categories: {error.message}
      </p>
    )
  }

  const categories = (data?.TrackingCategories ?? []).filter(
    (c) => c.Status === 'ACTIVE',
  )
  if (categories.length === 0) {
    return (
      <p className="font-body text-sm text-muted-foreground">
        No tracking categories found in Xero. Create one (e.g. "Property")
        with an option per property, then come back here to map them.
      </p>
    )
  }

  const categoryId =
    categoryInput ??
    savedMap?.trackingCategoryId ??
    categories[0].TrackingCategoryID
  const category =
    categories.find((c) => c.TrackingCategoryID === categoryId) ?? categories[0]
  const options = category.Options.filter((o) => o.Status === 'ACTIVE')

  const valueFor = (optionId: string) =>
    assignments[optionId] ??
    savedMap?.options.find((o) => o.trackingOptionId === optionId)
      ?.propertyId ??
    'none'

  const save = () => {
    const map: XeroTrackingMap = {
      trackingCategoryId: category.TrackingCategoryID,
      categoryName: category.Name,
      options: options.map((o) => ({
        trackingOptionId: o.TrackingOptionID,
        name: o.Name,
        propertyId:
          valueFor(o.TrackingOptionID) === 'none'
            ? null
            : valueFor(o.TrackingOptionID),
      })),
    }
    setSetting.mutate(
      { key: TRACKING_MAP_KEY, value: JSON.stringify(map) },
      {
        onSuccess: () => toast.success('Tracking category mapping saved'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-body text-sm font-medium text-navy">
          Tracking category mapping
        </p>
        <p className="font-body text-xs text-muted-foreground">
          Match each Xero tracking option to a property so the Financials P&L
          can report per property.
        </p>
      </div>

      {categories.length > 1 && (
        <div className="space-y-1.5">
          <Label>Xero tracking category</Label>
          <Select value={category.TrackingCategoryID} onValueChange={setCategoryInput}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.TrackingCategoryID} value={c.TrackingCategoryID}>
                  {c.Name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        {options.length === 0 && (
          <p className="font-body text-sm text-muted-foreground">
            "{category.Name}" has no active options in Xero.
          </p>
        )}
        {options.map((o) => (
          <div
            key={o.TrackingOptionID}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="font-body text-sm text-navy">{o.Name}</span>
            <Select
              value={valueFor(o.TrackingOptionID)}
              onValueChange={(v) =>
                setAssignments((prev) => ({ ...prev, [o.TrackingOptionID]: v }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not mapped</SelectItem>
                {(properties ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        onClick={save}
        disabled={setSetting.isPending || options.length === 0}
      >
        Save mapping
      </Button>
    </div>
  )
}

function XeroIntegrationBlock() {
  const { data: connection, isLoading } = useXeroConnection()
  const disconnect = useXeroDisconnect()
  const connected = connection?.connected ?? false

  const connectToXero = () => {
    const state = crypto.randomUUID()
    sessionStorage.setItem(XERO_STATE_STORAGE_KEY, state)
    // The function 302-redirects to login.xero.com/identity/connect/authorize
    // with client_id, redirect_uri, scopes and this state.
    window.location.href = `/.netlify/functions/xero-auth?state=${state}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-body text-sm font-medium text-navy">Xero</p>
            {connected ? (
              <Badge className="mt-1 bg-sage text-white">
                Connected — {connection?.orgName ?? 'Xero organisation'}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="mt-1 border-stone bg-muted text-muted-foreground"
              >
                Not connected
              </Badge>
            )}
          </div>
        </div>
        {connected ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={disconnect.isPending}>
                Disconnect
              </Button>
            }
            title="Disconnect Xero?"
            description="Removes the stored Xero tokens. The tracking category mapping is kept for when you reconnect."
            confirmLabel="Disconnect"
            onConfirm={() =>
              disconnect.mutate(undefined, {
                onSuccess: () => toast.success('Xero disconnected'),
                onError: (e) => toast.error(e.message),
              })
            }
          />
        ) : (
          <Button onClick={connectToXero} disabled={isLoading}>
            Connect Xero
          </Button>
        )}
      </div>

      {connected && <XeroTrackingMapConfig />}
    </div>
  )
}

function IntegrationsSection() {
  const { data: hubdocSetting, isLoading } = useAppSetting('hubdoc_email')
  const setSetting = useSetAppSetting()
  // null = untouched, falls back to the saved setting.
  const [hubdocInput, setHubdocInput] = useState<string | null>(null)
  const hubdocEmail = hubdocInput ?? hubdocSetting?.value ?? ''

  const saveHubdocEmail = () => {
    setSetting.mutate(
      { key: 'hubdoc_email', value: hubdocEmail.trim() || null },
      {
        onSuccess: () => toast.success('HubDoc intake email saved'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-2xl text-navy">
          Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <XeroIntegrationBlock />

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <p className="font-body text-sm font-medium text-navy">HubDoc</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hubdoc-email">Intake email address</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="hubdoc-email"
                type="email"
                className="min-w-0 flex-1"
                placeholder="upload.xxxx@hubdoc.com"
                value={hubdocEmail}
                onChange={(e) => setHubdocInput(e.target.value)}
                disabled={isLoading}
              />
              <Button
                variant="secondary"
                onClick={saveHubdocEmail}
                disabled={setSetting.isPending}
              >
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.info('Configure Resend API key first')}
              >
                <Send className="h-4 w-4" /> Test
              </Button>
            </div>
            <p className="font-body text-xs text-muted-foreground">
              Receipts will be forwarded to this address once email sending is
              configured.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const REMINDER_TOGGLES = [
  {
    key: 'rent-due',
    label: 'Rent due reminders',
    description: 'Weekly summary of rent falling due across the portfolio.',
  },
  {
    key: 'lease-renewal',
    label: 'Lease renewal alerts',
    description: 'Head leases approaching expiry (90 / 60 / 30 days out).',
  },
  {
    key: 'bond-return',
    label: 'Bond return reminders',
    description: 'Bonds still held after a lodger moves out.',
  },
]

function NotificationsSection() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-2xl text-navy">
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-body text-xs text-muted-foreground">
          Automated reminders are coming soon — these settings aren't active
          yet.
        </p>
        {REMINDER_TOGGLES.map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-body text-sm font-medium text-navy">
                {t.label}
              </p>
              <p className="font-body text-xs text-muted-foreground">
                {t.description}
              </p>
            </div>
            <Switch
              checked={enabled[t.key] ?? false}
              onCheckedChange={(v) =>
                setEnabled((prev) => ({ ...prev, [t.key]: v }))
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Account, integrations and notification preferences."
      />
      <AccountSection />
      <IntegrationsSection />
      <NotificationsSection />
    </div>
  )
}
