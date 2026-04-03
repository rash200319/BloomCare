"use client"

import { useEffect, useState } from "react"
import {
  Users,
  Plus,
  Search,
  Trash2,
  Eye,
  Globe,
  LogOut,
  AlertCircle,
  CheckCircle,
  Copy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Language = "EN" | "SI" | "TA"

interface StaffManagementProps {
  onLogout: () => void
}

interface StaffMember {
  id: string
  user_id: string
  full_name: string
  email: string
  nic: string
  telephone: string
  role: string
  specialization?: string
  is_active: boolean
  created_at: string
}

interface CreateStaffRequest {
  full_name: string
  nic: string
  telephone: string
  email: string
  role: "FRONTLINE_STAFF" | "CLINICAL_SPECIALIST"
  specialization?: string
  birthday?: string
}

interface StaffResponse {
  user_id: string
  temporary_password: string
}

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "")

function getApiBaseCandidates(): string[] {
  const candidates = [configuredApiBase, "http://localhost:8005/api/v1", "http://127.0.0.1:8005/api/v1"]

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:"
    const host = window.location.hostname || "localhost"
    candidates.push(`${protocol}//${host}:8005/api/v1`)
  }

  candidates.push("http://localhost:8005/api/v1", "http://127.0.0.1:8005/api/v1")

  return candidates.filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value as string) === index)
}

const languages = [
  { code: "EN", label: "English" },
  { code: "SI", label: "Sinhala" },
  { code: "TA", label: "Tamil" },
]

export default function StaffManagement({ onLogout }: StaffManagementProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("EN")
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [availableSpecializations, setAvailableSpecializations] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState<string | null>(null)
  const [newStaff, setNewStaff] = useState<CreateStaffRequest>({
    full_name: "",
    nic: "",
    telephone: "",
    email: "",
    role: "FRONTLINE_STAFF",
    specialization: "",
    birthday: "",
  })

  const getText = (en: string, si: string, ta: string) => {
    if (selectedLanguage === "SI") return si
    if (selectedLanguage === "TA") return ta
    return en
  }

  const getAccessToken = (): string | null => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem("bloomcare_access_token")
  }

  const apiRequest = async (path: string, init?: RequestInit): Promise<Response> => {
    const token = getAccessToken()
    if (!token) {
      throw new Error("No active session found. Please login again.")
    }

    const headers = new Headers(init?.headers)
    headers.set("Authorization", `Bearer ${token}`)
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }

    const candidates = getApiBaseCandidates()
    let lastError: unknown = null

    for (const base of candidates) {
      try {
        const response = await fetch(`${base}${path}`, {
          ...init,
          headers,
        })
        if (response.status === 404) {
          continue
        }
        return response
      } catch (error) {
        lastError = error
      }
    }

    if (lastError instanceof Error) {
      throw new Error(`Unable to reach backend API. ${lastError.message}`)
    }
    throw new Error("Unable to reach backend API.")
  }

  // Load staff list
  useEffect(() => {
    const loadStaff = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await apiRequest("/staff")
        const data = await response.json()
        setStaffList(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load staff")
      } finally {
        setIsLoading(false)
      }
    }
    loadStaff()
  }, [])

  useEffect(() => {
    const loadSpecializations = async () => {
      try {
        const response = await apiRequest("/appointments/specializations")
        const data = await response.json()
        const obstetricsSpecializations = Array.isArray(data)
          ? Array.from(
              new Set(
                data
                  .map((item: any) => String(item?.specialization || "").trim())
                  .filter((specialization) => /obstetr/i.test(specialization))
              )
            )
          : []
        setAvailableSpecializations(obstetricsSpecializations)
      } catch (err) {
        console.warn("Failed to load specializations:", err)
        setAvailableSpecializations([])
      }
    }

    loadSpecializations()
  }, [])

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newStaff.full_name || !newStaff.nic || !newStaff.email || !newStaff.telephone) {
      setError("Please fill all required fields")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await apiRequest("/staff/create-staff", {
        method: "POST",
        body: JSON.stringify(newStaff),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to create staff: ${response.statusText}`)
      }

      const data: StaffResponse = await response.json()
      setSuccessMessage(`Staff created! User ID: ${data.user_id}, Temporary Password: ${data.temporary_password}`)
      setShowPassword(data.temporary_password)

      // Reset form
      setNewStaff({
        full_name: "",
        nic: "",
        telephone: "",
        email: "",
        role: "FRONTLINE_STAFF",
        specialization: "",
        birthday: "",
      })

      // Reload staff list
      const listResponse = await apiRequest("/staff")
      const staffData = await listResponse.json()
      setStaffList(staffData)

      setTimeout(() => setShowCreateForm(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteStaff = async (userId: string) => {
    if (!window.confirm(getText("Are you sure?", "ඔබ විශ්වාස ද?", "நீங்கள் உறுதியாக இருக்கிறீர்களா?"))) {
      return
    }

    try {
      setError(null)
      const response = await apiRequest(`/staff/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete staff")
      }

      setStaffList(staffList.filter((s) => s.user_id !== userId))
      setSuccessMessage("Staff member deleted successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete staff")
    }
  }

  const filteredStaff = staffList.filter(
    (staff) =>
      staff.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleColor = (role: string) => {
    switch (role) {
      case "FRONTLINE_STAFF":
        return "bg-blue-100 text-blue-800"
      case "CLINICAL_SPECIALIST":
        return "bg-purple-100 text-purple-800"
      case "ADMIN":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                {getText("Staff Management", "කර්මීන් ප්‍රबंध", "பணியாளர் நிர்வாகம்")}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="flex items-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  {selectedLanguage}
                </Button>
                {showLanguageDropdown && (
                  <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setSelectedLanguage(lang.code as Language)
                          setShowLanguageDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                </Button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      {getText("Logout", "ලොගআউට්", "விளக்கம்")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-900">{successMessage}</h3>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">{error}</h3>
            </div>
          </div>
        )}

        {/* Search and Add Button */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder={getText("Search by name, ID, or email...", "නාම, අංකය හෝ ඊමේල්වලින් සොයන්න...", "பெயர், ID அல்லது ஈமெயிலால் தேடுங்கள்...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            {getText("Add Staff", "කර්මීන් එක් කරන්න", "பணியாளர் சேர்க்கவும்")}
          </Button>
        </div>

        {/* Create Staff Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{getText("Create New Staff Member", "නව කර්මීයා සාදන්න", "புதிய பணியாளரை তৈரി করুங்கள்")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText("Full Name *", "සම්පූර්ණ නම *", "முழு பெயர் *")}
                    </label>
                    <Input
                      value={newStaff.full_name}
                      onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                      placeholder={getText("Enter full name", "සම්පූර්ණ නම ඇතුළු කරන්න", "முழு பெயர் உள்ளிடவும்")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText("NIC *", "නිවැරදි අංකය *", "NIC *")}
                    </label>
                    <Input
                      value={newStaff.nic}
                      onChange={(e) => setNewStaff({ ...newStaff, nic: e.target.value })}
                      placeholder={getText("National ID", "ජාතික අංකය", "தேசிய ID")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText("Email *", "ඊමේල් *", "மின்னஞ்சல் *")}
                    </label>
                    <Input
                      type="email"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      placeholder={getText("Email address", "ඊමේල් ලිපිනය", "மின்னஞ்சல் முகவரி")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText("Telephone *", "දුරකථන *", "தொலைபேசி *")}
                    </label>
                    <Input
                      value={newStaff.telephone}
                      onChange={(e) => setNewStaff({ ...newStaff, telephone: e.target.value })}
                      placeholder={getText("Phone number", "දුරකථන අංකය", "தொலைபேசி எண்")}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText("Role *", "කාර්යය *", "பங்கு *")}
                    </label>
                    <select
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as "FRONTLINE_STAFF" | "CLINICAL_SPECIALIST" })}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="FRONTLINE_STAFF">{getText("Frontline Staff", "මුල්පෙළ කර්මීයා", "முன்சூচி பணியாளர்")}</option>
                      <option value="CLINICAL_SPECIALIST">{getText("Clinical Specialist", "ක්‍රිනිකල් විශේෂඥයා", "மருத்துவ நிபுணர்")}</option>
                    </select>
                  </div>

                  {newStaff.role === "CLINICAL_SPECIALIST" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getText("Specialization", "විශේෂීකරණ", "சிறப்பு")}
                      </label>
                      <select
                        value={newStaff.specialization || ""}
                        onChange={(e) => setNewStaff({ ...newStaff, specialization: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">{getText("Select specialization", "විශේෂීකරණ තෝරන්න", "சிறப்புத்தை தேர்வு செய்யவும்")}</option>
                        {availableSpecializations.map((spec) => (
                          <option key={spec} value={spec}>
                            {spec}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText("Date of Birth", "ജന്മതിയ", "பிறந்த தேதி")}
                    </label>
                    <Input
                      type="date"
                      value={newStaff.birthday || ""}
                      onChange={(e) => setNewStaff({ ...newStaff, birthday: e.target.value })}
                    />
                  </div>
                </div>

                {showPassword && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      {getText("Temporary Password:", "තාවකාලික මුරපදය:", "தற்காலிக கடவுச்சொல்:")}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-white border border-blue-300 rounded font-mono text-sm">
                        {showPassword}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(showPassword)
                          alert(getText("Copied!", "පිටපතයි!", "நகલெடுக்கப்பட்டது!"))
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false)
                      setShowPassword(null)
                    }}
                  >
                    {getText("Cancel", "අවලංගු කරන්න", "ரத்துசெய்யுங்கள்")}
                  </Button>
                  <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                    {isLoading ? getText("Creating...", "සෑදෙමින්...", "உருவாக்குகிறது...") : getText("Create Staff", "කර්මීයා සාදන්න", "பணியாளர் உருவாக்குங்கள்")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {getText("Staff Members", "කර්මීයා", "பணியாளர்கள்")} ({filteredStaff.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-gray-500">{getText("Loading...", "පවතින්න...", "ஏற்றுகிறது...")}</p>
            ) : filteredStaff.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                {getText("No staff members found", "කර්මීයා හමු නොවිණි", "பணியாளர்கள் கிடைக்கவில்லை")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">{getText("Name", "නම", "பெயர்")}</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">{getText("User ID", "පරිශ්‍රමිකයා අංකය", "பயனர் ID")}</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">{getText("Email", "ඊමේල්", "மின்னஞ்சல்")}</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">{getText("Role", "කාර්යය", "பங்கு")}</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">{getText("Specialization", "විශේෂීකරණ", "சிறப்பு")}</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">{getText("Status", "තත්ත්වය", "நிலை")}</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">{getText("Actions", "ක්‍රියා", "செயல்கள்")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff) => (
                      <tr key={staff.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">{staff.full_name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-600">{staff.user_id}</td>
                        <td className="py-3 px-4 text-gray-600">{staff.email}</td>
                        <td className="py-3 px-4">
                          <Badge className={getRoleColor(staff.role)}>
                            {staff.role.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{staff.specialization || "--"}</td>
                        <td className="py-3 px-4">
                          <Badge variant={staff.is_active ? "default" : "secondary"}>
                            {staff.is_active ? getText("Active", "왕성", "சক்தி") : getText("Inactive", "සක්‍රීයද්‍ය", "செயலற்ற")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteStaff(staff.user_id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
