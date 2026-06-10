import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { DashboardPageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatPKR } from "@/lib/currency"
import { useLanguage } from "@/lib/i18n"
import {
  Calculator,
  Building2,
  Landmark,
  TrendingUp,
  Percent,
  ArrowLeftRight,
  RotateCcw,
  DollarSign,
  PiggyBank,
  Receipt,
  BarChart2,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"

const TABS = [
  { id: "property",     icon: Building2,      label: "Property Price" },
  { id: "mortgage",     icon: Landmark,       label: "Mortgage" },
  { id: "rent",         icon: TrendingUp,     label: "Rent Yield" },
  { id: "commission",   icon: Percent,        label: "Commission" },
  { id: "downpayment",  icon: PiggyBank,      label: "Down Payment" },
  { id: "roi",          icon: BarChart2,       label: "ROI" },
  { id: "closing",      icon: Receipt,        label: "Closing Costs" },
  { id: "currency",     icon: ArrowLeftRight, label: "Currency" },
]

// Currency data is fetched live — no static rates here

function ResultRow({ label, value, highlight, sub }: { label: string; value: string; highlight?: boolean; sub?: string }) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg px-4 py-3",
      highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/40"
    )}>
      <div>
        <span className={cn("text-sm", highlight ? "font-semibold text-primary" : "text-muted-foreground")}>{label}</span>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
      <span className={cn("font-bold tabular-nums", highlight ? "text-primary text-base" : "text-foreground text-sm")}>{value}</span>
    </div>
  )
}

function CalcInput({
  label, value, onChange, placeholder, prefix, suffix, type = "number", hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; prefix?: string; suffix?: string; type?: string; hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none pointer-events-none">{prefix}</span>
        )}
        <Input
          type={type}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          className={cn("h-10 text-sm", prefix && "pl-8", suffix && "pr-12")}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function EmptyResult({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>
  )
}

// ─── Calculators ──────────────────────────────────────────

function PropertyCalc() {
  const [area, setArea] = useState("")
  const [pricePerSqft, setPricePerSqft] = useState("")

  const results = useMemo(() => {
    const a = parseFloat(area) || 0
    const p = parseFloat(pricePerSqft) || 0
    const total = a * p
    const transfer = total * 0.015
    const titleInsurance = total * 0.004
    const inspection = 500
    return { total, transfer, titleInsurance, inspection, totalCost: total + transfer + titleInsurance + inspection, valid: a > 0 && p > 0 }
  }, [area, pricePerSqft])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <CalcInput label="Property Area" value={area} onChange={setArea} placeholder="e.g. 2000" suffix="sqft" />
        <CalcInput label="Price per Sqft" value={pricePerSqft} onChange={setPricePerSqft} placeholder="e.g. 250" prefix="$" />
        <Button variant="outline" size="sm" onClick={() => { setArea(""); setPricePerSqft("") }} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Results</p>
        {results.valid ? (
          <>
            <ResultRow label="Purchase Price" value={formatPKR(results.total)} highlight />
            <ResultRow label="Price per Sqft" value={formatPKR(parseFloat(pricePerSqft))} />
            <ResultRow label="Transfer Tax (1.5%)" value={formatPKR(results.transfer)} />
            <ResultRow label="Title Insurance (0.4%)" value={formatPKR(results.titleInsurance)} />
            <ResultRow label="Inspection Fee (est.)" value={formatPKR(results.inspection)} />
            <ResultRow label="Total All-In Cost" value={formatPKR(results.totalCost)} highlight />
          </>
        ) : <EmptyResult text="Enter area and price per sqft to see results" />}
      </div>
    </div>
  )
}

function MortgageCalc() {
  const [principal, setPrincipal] = useState("")
  const [rate, setRate] = useState("")
  const [years, setYears] = useState("")
  const [downPct, setDownPct] = useState("")

  const results = useMemo(() => {
    const home = parseFloat(principal) || 0
    const dp = home * ((parseFloat(downPct) || 0) / 100)
    const P = home - dp
    const annualRate = parseFloat(rate) || 0
    const n = (parseFloat(years) || 0) * 12
    if (P <= 0 || annualRate <= 0 || n <= 0) return null
    const r = annualRate / 100 / 12
    const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const totalAmount = monthly * n
    const totalInterest = totalAmount - P
    return { monthly, totalAmount, totalInterest, loanAmount: P, downPayment: dp }
  }, [principal, rate, years, downPct])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <CalcInput label="Home Price" value={principal} onChange={setPrincipal} placeholder="e.g. 450000" prefix="$" />
        <CalcInput label="Down Payment" value={downPct} onChange={setDownPct} placeholder="e.g. 20" suffix="%" hint="% of price" />
        <CalcInput label="Interest Rate (APR)" value={rate} onChange={setRate} placeholder="e.g. 6.5" suffix="%" />
        <CalcInput label="Loan Term" value={years} onChange={setYears} placeholder="e.g. 30" suffix="yrs" />
        <Button variant="outline" size="sm" onClick={() => { setPrincipal(""); setRate(""); setYears(""); setDownPct("") }} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Results</p>
        {results ? (
          <>
            <ResultRow label="Monthly Payment" value={formatPKR(results.monthly)} highlight />
            <ResultRow label="Down Payment" value={formatPKR(results.downPayment)} />
            <ResultRow label="Loan Amount" value={formatPKR(results.loanAmount)} />
            <ResultRow label="Total Paid" value={formatPKR(results.totalAmount)} />
            <ResultRow label="Total Interest" value={formatPKR(results.totalInterest)} />
          </>
        ) : <EmptyResult text="Enter loan details to see monthly payment" />}
      </div>
    </div>
  )
}

function RentYieldCalc() {
  const [propertyPrice, setPropertyPrice] = useState("")
  const [monthlyRent, setMonthlyRent] = useState("")
  const [expenses, setExpenses] = useState("")

  const results = useMemo(() => {
    const price = parseFloat(propertyPrice) || 0
    const rent = parseFloat(monthlyRent) || 0
    const annualExpenses = parseFloat(expenses) || 0
    if (price <= 0 || rent <= 0) return null
    const annualRent = rent * 12
    const grossYield = (annualRent / price) * 100
    const netAnnual = annualRent - annualExpenses
    const netYield = (netAnnual / price) * 100
    const cashFlow = netAnnual / 12
    return { annualRent, grossYield, netYield, cashFlow, annualExpenses }
  }, [propertyPrice, monthlyRent, expenses])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <CalcInput label="Property Value" value={propertyPrice} onChange={setPropertyPrice} placeholder="e.g. 350000" prefix="$" />
        <CalcInput label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} placeholder="e.g. 2500" prefix="$" />
        <CalcInput label="Annual Expenses" value={expenses} onChange={setExpenses} placeholder="e.g. 4000" prefix="$" hint="taxes, maintenance, insurance" />
        <Button variant="outline" size="sm" onClick={() => { setPropertyPrice(""); setMonthlyRent(""); setExpenses("") }} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Results</p>
        {results ? (
          <>
            <ResultRow label="Gross Yield" value={`${results.grossYield.toFixed(2)}%`} highlight />
            <ResultRow label="Net Yield" value={`${results.netYield.toFixed(2)}%`} highlight />
            <ResultRow label="Annual Rental Income" value={formatPKR(results.annualRent)} />
            <ResultRow label="Annual Expenses" value={formatPKR(results.annualExpenses)} />
            <ResultRow label="Monthly Cash Flow" value={formatPKR(results.cashFlow)} sub="after expenses" />
          </>
        ) : <EmptyResult text="Enter property value and monthly rent" />}
      </div>
    </div>
  )
}

function CommissionCalc() {
  const [salePrice, setSalePrice] = useState("")
  const [commRate, setCommRate] = useState("3")
  const [splitPct, setSplitPct] = useState("")

  const results = useMemo(() => {
    const price = parseFloat(salePrice) || 0
    const rate = parseFloat(commRate) || 0
    const split = parseFloat(splitPct) || 0
    if (price <= 0 || rate <= 0) return null
    const gross = price * (rate / 100)
    const agentShare = split > 0 ? gross * (split / 100) : gross
    const brokerShare = gross - agentShare
    return { gross, agentShare, brokerShare, hasSplit: split > 0 }
  }, [salePrice, commRate, splitPct])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <CalcInput label="Sale Price" value={salePrice} onChange={setSalePrice} placeholder="e.g. 500000" prefix="$" />
        <CalcInput label="Commission Rate" value={commRate} onChange={setCommRate} placeholder="e.g. 3" suffix="%" />
        <CalcInput label="Agent Split" value={splitPct} onChange={setSplitPct} placeholder="e.g. 70" suffix="%" hint="optional" />
        <Button variant="outline" size="sm" onClick={() => { setSalePrice(""); setCommRate("3"); setSplitPct("") }} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Results</p>
        {results ? (
          <>
            <ResultRow label="Total Commission" value={formatPKR(results.gross)} highlight />
            {results.hasSplit ? (
              <>
                <ResultRow label="Agent Earnings" value={formatPKR(results.agentShare)} highlight />
                <ResultRow label="Broker Share" value={formatPKR(results.brokerShare)} />
              </>
            ) : (
              <ResultRow label="Your Earnings" value={formatPKR(results.agentShare)} highlight />
            )}
          </>
        ) : <EmptyResult text="Enter sale price and commission rate" />}
      </div>
    </div>
  )
}

function DownPaymentCalc() {
  const [homePrice, setHomePrice] = useState("")
  const [savings, setSavings] = useState("")

  const tiers = [
    { pct: 3,  label: "Minimum (Conv.)", color: "text-red-500" },
    { pct: 5,  label: "Low",             color: "text-orange-500" },
    { pct: 10, label: "Standard",        color: "text-amber-500" },
    { pct: 20, label: "Avoid PMI",       color: "text-green-500" },
    { pct: 25, label: "Strong equity",   color: "text-emerald-600" },
  ]

  const price = parseFloat(homePrice) || 0
  const saved = parseFloat(savings) || 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <CalcInput label="Home Price" value={homePrice} onChange={setHomePrice} placeholder="e.g. 400000" prefix="$" />
        <CalcInput label="Savings Available" value={savings} onChange={setSavings} placeholder="e.g. 80000" prefix="$" hint="what you have today" />
        <Button variant="outline" size="sm" onClick={() => { setHomePrice(""); setSavings("") }} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Down Payment Tiers</p>
        {price > 0 ? (
          <>
            {tiers.map((t) => {
              const amount = price * (t.pct / 100)
              const canAfford = saved >= amount
              const loan = price - amount
              return (
                <div key={t.pct} className={cn(
                  "flex items-center justify-between rounded-lg px-4 py-3 bg-muted/40",
                  canAfford && "ring-1 ring-primary/30 bg-primary/5"
                )}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold", t.color)}>{t.pct}%</span>
                      <span className="text-xs text-muted-foreground">{t.label}</span>
                      {canAfford && <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded-full font-semibold">✓ Affordable</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Loan: {formatPKR(loan)}</p>
                  </div>
                  <span className="font-bold text-foreground tabular-nums text-sm">{formatPKR(amount)}</span>
                </div>
              )
            })}
          </>
        ) : <EmptyResult text="Enter home price to see down payment tiers" />}
      </div>
    </div>
  )
}

function ROICalc() {
  const [purchasePrice, setPurchasePrice] = useState("")
  const [renovations, setRenovations] = useState("")
  const [salePrice, setSalePrice] = useState("")
  const [holdYears, setHoldYears] = useState("")
  const [annualRent, setAnnualRent] = useState("")
  const [annualExp, setAnnualExp] = useState("")

  const results = useMemo(() => {
    const purchase = parseFloat(purchasePrice) || 0
    const reno = parseFloat(renovations) || 0
    const sale = parseFloat(salePrice) || 0
    const years = parseFloat(holdYears) || 1
    const rent = parseFloat(annualRent) || 0
    const exp = parseFloat(annualExp) || 0
    if (purchase <= 0) return null

    const totalInvested = purchase + reno
    const appreciation = Math.max(0, sale - purchase)
    const rentalProfit = (rent - exp) * years
    const totalReturn = appreciation + rentalProfit
    const roi = (totalReturn / totalInvested) * 100
    const annualizedROI = ((Math.pow(1 + roi / 100, 1 / years) - 1) * 100)

    return { totalInvested, appreciation, rentalProfit, totalReturn, roi, annualizedROI, hasRent: rent > 0, hasSale: sale > 0 }
  }, [purchasePrice, renovations, salePrice, holdYears, annualRent, annualExp])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <CalcInput label="Purchase Price" value={purchasePrice} onChange={setPurchasePrice} placeholder="e.g. 300000" prefix="$" />
        <CalcInput label="Renovation / Closing Costs" value={renovations} onChange={setRenovations} placeholder="e.g. 15000" prefix="$" hint="optional" />
        <CalcInput label="Expected Sale Price" value={salePrice} onChange={setSalePrice} placeholder="e.g. 380000" prefix="$" hint="optional" />
        <CalcInput label="Hold Period" value={holdYears} onChange={setHoldYears} placeholder="e.g. 5" suffix="yrs" />
        <CalcInput label="Annual Rental Income" value={annualRent} onChange={setAnnualRent} placeholder="e.g. 24000" prefix="$" hint="optional" />
        <CalcInput label="Annual Expenses" value={annualExp} onChange={setAnnualExp} placeholder="e.g. 6000" prefix="$" hint="taxes, maintenance" />
        <Button variant="outline" size="sm" onClick={() => { setPurchasePrice(""); setRenovations(""); setSalePrice(""); setHoldYears(""); setAnnualRent(""); setAnnualExp("") }} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Results</p>
        {results ? (
          <>
            <ResultRow label="Total ROI" value={`${results.roi.toFixed(2)}%`} highlight />
            <ResultRow label="Annualized ROI" value={`${results.annualizedROI.toFixed(2)}%/yr`} highlight />
            <ResultRow label="Total Invested" value={formatPKR(results.totalInvested)} />
            {results.hasSale && <ResultRow label="Appreciation Profit" value={formatPKR(results.appreciation)} />}
            {results.hasRent && <ResultRow label="Rental Profit (total)" value={formatPKR(results.rentalProfit)} />}
            <ResultRow label="Total Return" value={formatPKR(results.totalReturn)} />
          </>
        ) : <EmptyResult text="Enter purchase price to calculate ROI" />}
      </div>
    </div>
  )
}

function ClosingCostsCalc() {
  const [salePrice, setSalePrice] = useState("")
  const [isBuyer, setIsBuyer] = useState(true)
  const [loanAmount, setLoanAmount] = useState("")
  const [state, setState] = useState("avg")

  const stateRates: Record<string, { transfer: number; label: string }> = {
    avg:  { transfer: 0.015, label: "National Average" },
    ny:   { transfer: 0.04,  label: "New York" },
    ca:   { transfer: 0.011, label: "California" },
    fl:   { transfer: 0.007, label: "Florida" },
    tx:   { transfer: 0.005, label: "Texas" },
  }

  const results = useMemo(() => {
    const price = parseFloat(salePrice) || 0
    const loan = parseFloat(loanAmount) || 0
    if (price <= 0) return null
    const { transfer } = stateRates[state]

    if (isBuyer) {
      const loanOrigination = loan * 0.01
      const appraisal = 600
      const titleSearch = 300
      const titleIns = price * 0.004
      const inspection = 500
      const escrow = price * 0.001
      const prepaid = price * 0.003
      const total = loanOrigination + appraisal + titleSearch + titleIns + inspection + escrow + prepaid
      return { items: [
        { label: "Loan Origination (1%)", value: loanOrigination },
        { label: "Appraisal Fee", value: appraisal },
        { label: "Title Search", value: titleSearch },
        { label: "Title Insurance (0.4%)", value: titleIns },
        { label: "Home Inspection", value: inspection },
        { label: "Escrow Fee (0.1%)", value: escrow },
        { label: "Prepaid Costs (0.3%)", value: prepaid },
      ], total }
    } else {
      const agentComm = price * 0.03
      const transferTax = price * transfer
      const titleIns = price * 0.004
      const escrow = price * 0.001
      const concessions = price * 0.01
      const total = agentComm + transferTax + titleIns + escrow + concessions
      return { items: [
        { label: "Agent Commission (3%)", value: agentComm },
        { label: `Transfer Tax (${(transfer * 100).toFixed(1)}%)`, value: transferTax },
        { label: "Title Insurance (0.4%)", value: titleIns },
        { label: "Escrow Fee (0.1%)", value: escrow },
        { label: "Seller Concessions (1%)", value: concessions },
      ], total }
    }
  }, [salePrice, isBuyer, loanAmount, state])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <CalcInput label={isBuyer ? "Purchase Price" : "Sale Price"} value={salePrice} onChange={setSalePrice} placeholder="e.g. 450000" prefix="$" />
        {isBuyer && (
          <CalcInput label="Loan Amount" value={loanAmount} onChange={setLoanAmount} placeholder="e.g. 360000" prefix="$" />
        )}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">State</Label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {Object.entries(stateRates).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsBuyer(true)}
            className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
              isBuyer ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}
          >Buyer</button>
          <button
            onClick={() => setIsBuyer(false)}
            className={cn("flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
              !isBuyer ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}
          >Seller</button>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSalePrice(""); setLoanAmount("") }} className="gap-2 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{isBuyer ? "Buyer" : "Seller"} Closing Costs</p>
        {results ? (
          <>
            {results.items.map((item) => (
              <ResultRow key={item.label} label={item.label} value={formatPKR(item.value)} />
            ))}
            <ResultRow label="Total Closing Costs" value={formatPKR(results.total)} highlight />
            <p className="text-[10px] text-muted-foreground pt-1">Estimates vary by lender and location.</p>
          </>
        ) : <EmptyResult text="Enter sale price to estimate closing costs" />}
      </div>
    </div>
  )
}

const CACHE_KEY = "fx_rates_cache"
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

type RateCache = {
  base: string
  rates: Record<string, number>
  names: Record<string, string>
  fetchedAt: number
}

function loadCache(): RateCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: RateCache = JSON.parse(raw)
    if (Date.now() - parsed.fetchedAt > CACHE_TTL) return null
    return parsed
  } catch {
    return null
  }
}

function saveCache(data: RateCache) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

function CurrencyCalc() {
  const [fromAmount, setFromAmount] = useState("1")
  const [fromCurrency, setFromCurrency] = useState("USD")
  const [toCurrency, setToCurrency] = useState("EUR")
  const [rates, setRates] = useState<Record<string, number>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const fetchRef = useRef(false)

  const fetchRates = useCallback(async (base: string, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = loadCache()
      if (cached && cached.base === base) {
        setRates(cached.rates)
        setNames(cached.names)
        setFetchedAt(cached.fetchedAt)
        return
      }
    }
    setLoading(true)
    setFetchError(false)
    try {
      const [ratesRes, namesRes] = await Promise.all([
        fetch(`https://api.frankfurter.app/latest?from=${base}`),
        fetch("https://api.frankfurter.app/currencies"),
      ])
      if (!ratesRes.ok || !namesRes.ok) throw new Error("fetch failed")
      const ratesData = await ratesRes.json()
      const namesData: Record<string, string> = await namesRes.json()
      const allRates: Record<string, number> = { ...ratesData.rates, [base]: 1 }
      const cache: RateCache = { base, rates: allRates, names: namesData, fetchedAt: Date.now() }
      saveCache(cache)
      setRates(allRates)
      setNames(namesData)
      setFetchedAt(cache.fetchedAt)
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fetchRef.current) return
    fetchRef.current = true
    fetchRates(fromCurrency)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when fromCurrency changes (need a new base)
  const prevFromRef = useRef(fromCurrency)
  useEffect(() => {
    if (prevFromRef.current !== fromCurrency) {
      prevFromRef.current = fromCurrency
      fetchRates(fromCurrency)
    }
  }, [fromCurrency, fetchRates])

  const currencies = useMemo(() => Object.keys(names).sort(), [names])

  const toAmount = useMemo(() => {
    const amt = parseFloat(fromAmount)
    if (!amt || !rates[toCurrency]) return ""
    return (amt * rates[toCurrency]).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }, [fromAmount, toCurrency, rates])

  const rateLabel = useMemo(() => {
    if (!rates[toCurrency]) return null
    const r = rates[toCurrency]
    return `1 ${fromCurrency} = ${r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${toCurrency}`
  }, [fromCurrency, toCurrency, rates])

  const lastUpdated = useMemo(() => {
    if (!fetchedAt) return null
    const mins = Math.floor((Date.now() - fetchedAt) / 60000)
    if (mins < 1) return "Just updated"
    if (mins === 1) return "1 minute ago"
    return `${mins} minutes ago`
  }, [fetchedAt])

  function handleSwap() {
    const oldTo = toCurrency
    setToCurrency(fromCurrency)
    setFromCurrency(oldTo)
    // rates will re-fetch via the effect above
  }

  const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* From row */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="number"
              inputMode="decimal"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="h-12 text-2xl font-bold tabular-nums border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              placeholder="1"
            />
          </div>
          <div className="w-36 flex-shrink-0">
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className={cn(selectClass, "h-12 text-base")}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>{c} — {names[c] ?? c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Swap button */}
      <div className="flex items-center justify-center">
        <button
          onClick={handleSwap}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-95"
          title="Swap currencies"
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
      </div>

      {/* To row */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Converted</p>
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center gap-2 h-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Fetching live rates…</span>
              </div>
            ) : fetchError ? (
              <div className="flex items-center gap-2 h-12 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Failed to load rates</span>
              </div>
            ) : (
              <p className="text-2xl font-bold tabular-nums text-primary leading-none py-2.5">
                {toAmount || "—"}
              </p>
            )}
          </div>
          <div className="w-36 flex-shrink-0">
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className={cn(selectClass, "h-12 text-base")}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>{c} — {names[c] ?? c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rate info bar */}
      {rateLabel && !loading && !fetchError && (
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">{rateLabel}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lastUpdated && <span>{lastUpdated}</span>}
            <button
              onClick={() => fetchRates(fromCurrency, true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted transition-colors"
              title="Refresh rates"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </div>
      )}

      {fetchError && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => fetchRates(fromCurrency, true)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry loading rates
        </Button>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Rates from{" "}
        <a href="https://frankfurter.app" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          Frankfurter (ECB)
        </a>
        . Refreshed every 15 minutes. Verify before transactions.
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

export default function CalculatorPage() {
  const [activeTab, setActiveTab] = useState("property")

  return (
    <div className="flex flex-col h-full">
      <DashboardPageHeader
        title="Financial Calculator"
        description="Property, mortgage, ROI, closing costs, commission & currency tools"
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-xl border border-border bg-card p-6"
        >
          <div className="mb-5 flex items-center gap-2">
            {(() => {
              const tab = TABS.find((t) => t.id === activeTab)!
              return (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <tab.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{tab.label}</h2>
                </>
              )
            })()}
          </div>
          {activeTab === "property"    && <PropertyCalc />}
          {activeTab === "mortgage"    && <MortgageCalc />}
          {activeTab === "rent"        && <RentYieldCalc />}
          {activeTab === "commission"  && <CommissionCalc />}
          {activeTab === "downpayment" && <DownPaymentCalc />}
          {activeTab === "roi"         && <ROICalc />}
          {activeTab === "closing"     && <ClosingCostsCalc />}
          {activeTab === "currency"    && <CurrencyCalc />}
        </motion.div>
      </div>
    </div>
  )
}
