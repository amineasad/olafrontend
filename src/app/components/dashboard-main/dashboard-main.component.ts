import { Component, OnInit, OnDestroy } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { KpiService, KpiValue, ChartSeries } from 'src/app/services/kpi.service';
import { MailService } from 'src/app/services/mail.service';
import { ForecastService, ForecastResult } from 'src/app/services/forecast.service';
import { Chart } from 'chart.js/auto';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AnomalyService, AnomalyResponse, AnomalyResult } from 'src/app/services/anomaly.service';
import { AuthService } from 'src/app/services/auth.service';
const KPI_ICONS: Record<string, string> = {
  'On_time_delivery_rate':'🎯','Delivery Truck Accident':'🚨','Fleet_utilization_rate':'🚛',
  'Total_Fleet_OPEX_EUR':'💰','Total_Fleet_OPEX_EUR ':'💰','Number_of_deliveries':'📦',
  'Distance_km':'🗺️','Monthly Driver Violations':'⚠️','Monthly Driver Violations ':'⚠️',
  'Driver_compliance_rate':'✅','Unit_Cost_per_m3':'💲','Number_of_trucks_operating_during_the_month':'🔧',
  'Number_of_trucks_operating_during_the_month ':'🔧','Avg_hours_per_truck_per_day':'⏱️',
  'Number_of_working_days_in_the_month':'📅','Total_volume_m3':'📐','Spill/Cross-Fuel Incident':'⛽',
  'Total Drivers':'👤','Total Drivers ':'👤','Total_trucks':'🚚','Planned_orders':'📋',
  'Total_driving_hours':'🕐','Total_hours_worked':'⏰','Total_delivery_hours':'🚀',
  'Total_loading_hours':'⏳','Number_of_loadings':'📤','Delivery_delays_technical':'🔴','Legal_12h_compliance':'⚖️',
};

export interface AnalyticsStat {
  label:     string;
  value:     string;
  delta:     string;
  positive:  boolean;
  target?:   string;
  hasTarget?: boolean;
}

@Component({
  selector: 'app-dashboard-main',
  templateUrl: './dashboard-main.component.html',
  styleUrls: ['./dashboard-main.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class DashboardMainComponent implements OnInit, OnDestroy {

  dashboardReady = false;
  loading        = false;
  errorMsg       = '';
  lastImport     = '--';

  selectedFile?: File;
  importing     = false;
  importMsg     = '';
  importError   = false;
  isDragOver    = false;

  affiliates:       string[] = [];
  years:            number[] = [];
  months:           string[] = [];
  selectedAffiliate = '';
  selectedYear!:    number;
  selectedMonth     = 'ALL';

  allKpis:        KpiValue[]      = [];
  analyticsStats: AnalyticsStat[] = [];
  tableSearch = '';

  aiSummary    = '';
  aiSummaryHtml: SafeHtml = '';
  aiLoading    = false;
  aiError      = '';

  forecastLoading = false;
  forecastError   = '';
  forecastResult: ForecastResult | null = null;
  forecastKpi     = 'Number_of_deliveries';

  anomalyLoading = false;
  anomalyError   = '';
  anomalyResponse: AnomalyResponse | null = null;
  anomalyRows: any[]    = [];
  allAnomalyRows: any[] = [];

  showAllAnomaliesModal  = false;
  showAnomalyDetailModal = false;
  selectedAnomalyDetail: any = null;
  currentUser: any;

  // ── Helpers privés ────────────────────────────────────────
  private getSelectedTargetMonth(): string | undefined {
    if (!this.selectedYear || !this.selectedMonth || this.selectedMonth === 'ALL') return undefined;
    const monthMap: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', June: '06',
      July: '07', August: '08', September: '09', October: '10', November: '11', December: '12'
    };
    const num = monthMap[this.selectedMonth];
    return num ? `${this.selectedYear}-${num}` : undefined;
  }

  private severityLabel(level: 'normal' | 'attention' | 'critique'): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (level === 'critique') return 'HIGH';
    if (level === 'attention') return 'MEDIUM';
    return 'LOW';
  }

  private severityClass(level: 'normal' | 'attention' | 'critique'): string {
    if (level === 'critique') return 'sev-high';
    if (level === 'attention') return 'sev-medium';
    return 'sev-low';
  }

  // ── PUBLIC — appelé depuis le HTML ────────────────────────
  public featureLabel(feature: string): string {
    const labels: Record<string, string> = {
      cost_per_km:               'Coût transport par km anormal',
      delivery_productivity:     'Productivité livraison anormale',
      truck_productivity:        'Productivité camion anormale',
      driver_compliance_rate:    'Conformité conducteurs anormale',
      Number_of_deliveries:      'Nombre de livraisons anormal',
      Total_volume_m3:           'Volume transporté anormal',
      Distance_km:               'Distance parcourue anormale',
      Total_Fleet_OPEX_EUR:      'Coût opérationnel total de la flotte anormal',
      Unit_Cost_per_m3:          'Coût unitaire anormal',
      Number_of_trucks_operating_during_the_month: 'Nombre de camions opérants anormal',
      Planned_orders:            'Volume planifié inhabituel',
    };
    return labels[feature] || this.prettyLabel(feature);
  }

  // ── UNE LIGNE PAR ANOMALIE INDIVIDUELLE ──────────────────
  // business_alert → 1 ligne chacune
  // seasonal_alert → 1 ligne chacune
  // ML seul sans alert → 1 ligne générique
 private toUiRows(result: AnomalyResult): any[] {
  const rows: any[] = [];

  // =========================
  // 1. REGLES METIER
  // =========================
  for (const alert of result.business_alerts || []) {
    rows.push({
      month: result.month,
      dateLabel: result.month,
      site: this.selectedAffiliate,
      type: `regle metier: ${this.businessLabel(alert.message)}`,
      severity: this.severityLabel(alert.severity),
      severityClass: this.severityClass(alert.severity),
      detailText: this.businessDetail(alert.message),
      raw: result
    });
  }

  // =========================
  // 2. SAISONNIER
  // =========================
  for (const sa of result.seasonal_alerts || []) {
    rows.push({
      month: result.month,
      dateLabel: result.month,
      site: this.selectedAffiliate,
      type: `anoamlie saisoniere: ${this.featureLabel(sa.kpi)}`,
      severity: this.severityLabel(result.final_level),
      severityClass: this.severityClass(result.final_level),
      detailText:
        `${this.featureLabel(sa.kpi)}  par rapport au même mois des années précédentes.`,
      raw: result
    });
  }

  // =========================
// 3. 🔥 ML (IMPORTANT)
// =========================
const top = result.top_contributors?.[0];

// 🔥 vérifier doublon AVEC top déjà défini
if (result.ml_anomaly === 1) {

  const label = top ? this.featureLabel(top.feature) : 'comportement global';

  rows.push({
    month: result.month,
    dateLabel: result.month,
    site: this.selectedAffiliate,

    // 🔥 FUSION PROPRE
    type: `Anomalie intelligente : ${label}`,

    severity: this.severityLabel(result.final_level),
    severityClass: this.severityClass(result.final_level),

    // 🔥 EXPLICATION AMÉLIORÉE
   detailText: top
  ? this.smartMlDetail(top, label)
  : `Le modèle ML a détecté un comportement global inhabituel sur ce mois, en analysant la combinaison des KPI opérationnels, coûts et productivité.`,

    raw: result
  });
}

  // =========================
  // 4. FALLBACK
  // =========================
  if (rows.length === 0 && result.final_level !== 'normal') {
    rows.push({
      month: result.month,
      dateLabel: result.month,
      site: this.selectedAffiliate,
      type: 'Anomalie detectee',
      severity: this.severityLabel(result.final_level),
      severityClass: this.severityClass(result.final_level),
      detailText: 'Une anomalie a ete detectee ce mois.',
      raw: result
    });
  }

  return rows;
}
private smartMlDetail(top: any, label: string): string {

  if (top?.feature === 'cost_per_km') {
    return `Le coût de transport par kilomètre est inhabituel par rapport aux tendances habituelles, ce qui peut indiquer une inefficacité opérationnelle.`;
  }

  if (top?.feature === 'Unit_Cost_per_m3') {
    return `Le coût unitaire est inhabituel, ce qui peut être lié à une variation des coûts ou du volume transporté.`;
  }

  if (top?.feature === 'Total_Fleet_OPEX_EUR') {
    return `Les coûts opérationnels de la flotte présentent un comportement inhabituel ce mois.`;
  }

  if (top?.feature === 'Distance_km') {
    return `La distance parcourue présente une variation inhabituelle par rapport aux tendances normales.`;
  }

  if (top?.feature === 'delivery_productivity') {
    return `La productivité des livraisons semble inhabituelle ce mois.`;
  }

  if (top?.feature === 'truck_productivity') {
    return `La productivité des camions est inhabituelle, ce qui peut indiquer une sous-utilisation de la flotte.`;
  }

  return `Le comportement global des indicateurs ce mois est inhabituel par rapport aux tendances historiques.`;
}
  private businessDetail(message: string): string {
  const map: Record<string, string> = {
    'Accident':
      'Un accident de camion a ete enregistre ce mois. Verifier les conditions de securite.',
    'Incident carburant':
      'Un incident carburant a ete detecte. Auditer les procedures de ravitaillement.',
    'Cout actuel > cout planifie':
      'Le cout reel depasse le budget planifie. Analyser les depenses.',
    'Faible utilisation de la flotte':
      'Moins de 85% des camions sont operationnels.',
    'OTD faible':
      'le nombre de livraisons est tres faible par rapport aux nombres de livraisons planifiées',
    'OTD moyen':
      'le nombre de livraisons est moyen par rapport aux nombres de livraisons planifiées',
  };

  return map[message] || message;
}
private businessLabel(message: string): string {
  const map: Record<string, string> = {
    'Accident': 'Accident camion',
    'Incident carburant': 'Incident carburant',
    'Cout actuel > cout planifie': 'Cout > budget',
    'Faible utilisation de la flotte': 'Flotte sous-utilisee',
    'OTD faible': 'nombres de livraisons effectuées< nombres de livrraisons planifiées',
    'OTD moyen': 'nombres de livraisons effectuées< nombres de livrraisons planifiées'
  };
  return map[message] || message;
}
  get forecastKpiLabel(): string {
    const labels: Record<string, string> = {
      'Number_of_deliveries': 'Livraisons (m³)',
      'Total_volume_m3':      'Volume m³',
      'Total_Fleet_OPEX_EUR': 'Coût operationnel',
      'Distance_km':          'Distance KM',
    };
    return labels[this.forecastKpi] ?? this.forecastKpi;
  }

  private trendChart?: Chart;
  showChartModal = false;
  modalTitle     = '';
  modalError     = '';

  constructor(
    private kpiService:      KpiService,
    private forecastService: ForecastService,
    private sanitizer:       DomSanitizer,
    private mailService:     MailService,
    private anomalyService:  AnomalyService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
  this.currentUser = this.authService.getCurrentUser();
}
  ngOnDestroy(): void { this.trendChart?.destroy(); }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragOver = true; }
  onDrop(e: DragEvent): void {
    e.preventDefault(); this.isDragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) this.selectedFile = f;
  }
  onFileSelected(e: Event): void {
    const inp = e.target as HTMLInputElement;
    if (inp.files?.[0]) this.selectedFile = inp.files[0];
  }

  importExcel(): void {
    if (!this.selectedFile) return;
    this.importing = true; this.importMsg = ''; this.importError = false;
    this.kpiService.importKpis(this.selectedFile).subscribe({
      next: (res) => {
        this.importMsg = res; this.importing = false; this.dashboardReady = true;
        this.lastImport = new Date().toLocaleDateString('fr-FR') + ' ' +
                          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        this.initFilters();
      },
      error: (e) => { this.importing = false; this.importMsg = e?.error || 'Erreur import.'; this.importError = true; },
    });
  }

  resetImport(): void {
    this.dashboardReady = false; this.selectedFile = undefined;
    this.importMsg = ''; this.importError = false; this.allKpis = [];
    this.forecastResult = null; this.aiSummary = '';
    this.trendChart?.destroy();
  }

  private initFilters(): void {
    this.kpiService.getAffiliates().subscribe({
      next: (affs) => {
        this.affiliates = affs || []; this.selectedAffiliate = this.affiliates[0] || '';
        this.kpiService.getYears().subscribe({
          next: (yrs) => {
            this.years = yrs || []; this.selectedYear = this.years[0] || new Date().getFullYear();
            this.loadMonths();
          },
        });
      },
    });
  }

  loadMonths(): void {
    if (!this.selectedAffiliate || !this.selectedYear) return;
    this.kpiService.getMonths(this.selectedAffiliate, this.selectedYear).subscribe({
      next: (ms) => {
        this.months = ms || [];
        if (!this.months.includes(this.selectedMonth)) this.selectedMonth = 'ALL';
        this.applyDashboard();
      },
    });
  }

  onAffiliateChange(): void { this.loadMonths(); }
  onYearChange(): void      { this.loadMonths(); }

  applyDashboard(): void {
    if (!this.selectedAffiliate || !this.selectedYear) return;
    this.loading = true; this.errorMsg = '';
    const obs = this.selectedMonth === 'ALL'
      ? this.kpiService.getKpisAverage(this.selectedAffiliate, this.selectedYear)
      : this.kpiService.getKpis(this.selectedAffiliate, this.selectedMonth, this.selectedYear);
    obs.subscribe({
      next: (data) => {
        this.allKpis = data || [];
        this.loading = false;
        this.buildStats();
        this.loadAnomalies();
      },
      error: () => { this.errorMsg = 'Erreur chargement.'; this.loading = false; },
    });
  }

  loadAnomalies(): void {
    if (!this.selectedAffiliate || !this.selectedYear) return;
    this.anomalyLoading = true;
    this.anomalyError   = '';
    this.anomalyRows    = [];
    this.allAnomalyRows = [];
    const targetMonth = this.getSelectedTargetMonth();
    this.anomalyService.getAnomalies(this.selectedAffiliate, [2023, 2024, 2025], targetMonth).subscribe({
      next: (res) => {
        this.anomalyResponse = res;
        const results    = res?.results || [];
        const filtered   = targetMonth ? results.filter(r => r.month === targetMonth) : results;
        const anomalyOnly = filtered.filter(r => r.final_level !== 'normal');
        // flatMap : une ligne par anomalie individuelle, pas par mois
        this.allAnomalyRows = anomalyOnly.flatMap(r => this.toUiRows(r));
        this.anomalyRows    = this.allAnomalyRows.slice(0, 4);
        this.anomalyLoading = false;
      },
      error: () => { this.anomalyError = 'Erreur chargement anomalies.'; this.anomalyLoading = false; },
    });
  }

  openAllAnomalies(): void  { this.showAllAnomaliesModal = true; }
  closeAllAnomalies(): void { this.showAllAnomaliesModal = false; }

  openAnomalyDetail(row: any): void {
    this.selectedAnomalyDetail  = row;
    this.showAnomalyDetailModal = true;
  }
  closeAnomalyDetail(): void {
    this.showAnomalyDetailModal = false;
    this.selectedAnomalyDetail  = null;
  }

  private getVal(code: string, source: KpiValue[] = this.allKpis): number {
    const k = source.find(k => k.kpiCode.trim().toLowerCase() === code.trim().toLowerCase());
    return k?.value ?? 0;
  }

  private getPrevMonth(): string | null {
    if (this.selectedMonth === 'ALL') return null;
    const idx = this.months.indexOf(this.selectedMonth);
    return idx > 0 ? this.months[idx - 1] : null;
  }

  private formatDelta(cur: number, prev: number): { text: string; positive: boolean } {
    if (!prev) return { text: '--', positive: true };
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, positive: pct >= 0 };
  }

  private buildStats(): void {
    const delivs   = this.getVal('Number_of_deliveries');
    const opex     = this.getVal('Total_Fleet_OPEX_EUR');
    const delays   = this.getVal('Delivery_delays_technical');
    const accid    = this.getVal('Delivery Truck Accident');
    const spill    = this.getVal('Spill/Cross-Fuel Incident');
    const vol      = this.getVal('Total_volume_m3');
    const unitCost = this.getVal('Unit_Cost_per_m3');
    const planCost = this.getVal('Plan_Unit_Cost_per_m3_EUR');
    const loadings = this.getVal('Number_of_loadings');
    const trucks   = this.getVal('Total_trucks');

    const prevMonth = this.getPrevMonth();
    const buildWith = (prev: KpiValue[]) => {
      const dDeliv    = this.formatDelta(delivs,   this.getVal('Number_of_deliveries', prev));
      const dOpex     = this.formatDelta(opex,     this.getVal('Total_Fleet_OPEX_EUR', prev));
      const dDelay    = this.formatDelta(delays,   this.getVal('Delivery_delays_technical', prev));
      const dVol      = this.formatDelta(vol,      this.getVal('Total_volume_m3', prev));
      const dUnitCost = this.formatDelta(unitCost, this.getVal('Unit_Cost_per_m3', prev));
      const dLoadings = this.formatDelta(loadings, this.getVal('Number_of_loadings', prev));
      const dTrucks   = this.formatDelta(trucks,   this.getVal('Total_trucks', prev));

      const sheIncidents = spill + accid;
      const dShe = this.formatDelta(sheIncidents,
        this.getVal('Spill/Cross-Fuel Incident', prev) + this.getVal('Delivery Truck Accident', prev));

      const planned     = this.getVal('Planned_orders');
      const tauxService = planned > 0 ? (delivs / planned * 100) : 0;
      const prevPlanned = this.getVal('Planned_orders', prev);
      const prevTaux    = prevPlanned > 0 ? (this.getVal('Number_of_deliveries', prev) / prevPlanned * 100) : 0;
      const dTaux       = this.formatDelta(tauxService, prevTaux);

      this.analyticsStats = [
        { label: 'Number_of_deliveries',  value: new Intl.NumberFormat('fr-FR').format(Math.round(delivs)), delta: dDeliv.text, positive: dDeliv.positive },
        { label: 'Total_Fleet_OPEX_EUR',        value: opex > 0 ? new Intl.NumberFormat('fr-FR').format(Math.round(opex)) : '--', delta: dOpex.text, positive: !dOpex.positive },
        { label: 'Delivery_delays_technical',    value: String(Math.round(delays)), delta: dDelay.text, positive: !dDelay.positive },
        { label: 'SHE Incidents(Spill/Cross-Fuel Incident+Delivery Truck Accident)',         value: String(Math.round(sheIncidents)), delta: dShe.text, positive: !dShe.positive },
        { label: 'On_time_delivery_rate(Number_of_deliveries/Planned_orders)', value: tauxService > 0 ? tauxService.toFixed(1) + '%' : '--', delta: dTaux.text, positive: dTaux.positive },
        { label: 'Total_volume_m3',             value: new Intl.NumberFormat('fr-FR').format(Math.round(vol)), delta: dVol.text, positive: dVol.positive },
        { label: 'Unit_Cost_per_m3 vs Plan_Unit_Cost_per_m3_EUR ',
          value:    unitCost > 0 ? unitCost.toFixed(2) + ' €/m³' : '--',
          target:   planCost > 0 ? planCost.toFixed(2) + ' €/m³' : '--',
          delta:    planCost > 0 ? (((unitCost - planCost) / planCost) * 100).toFixed(1) + '% vs plan' : '--',
          positive: planCost > 0 ? unitCost <= planCost : true,
          hasTarget: true },
        { label: 'Number_of_loadings', value: new Intl.NumberFormat('fr-FR').format(Math.round(loadings)), delta: dLoadings.text, positive: dLoadings.positive },
        { label: 'Total_trucks',         value: String(Math.round(trucks)), delta: dTrucks.text, positive: dTrucks.positive },
      ];
    };

    if (prevMonth) {
      this.kpiService.getKpis(this.selectedAffiliate, prevMonth, this.selectedYear)
        .subscribe({ next: (d) => buildWith(d || []), error: () => buildWith([]) });
    } else { buildWith([]); }
  }

  get filteredTableKpis(): KpiValue[] {
    if (!this.tableSearch.trim()) return this.allKpis;
    const q = this.tableSearch.toLowerCase();
    return this.allKpis.filter(k =>
      k.kpiCode.toLowerCase().includes(q) || this.prettyLabel(k.kpiCode).toLowerCase().includes(q)
    );
  }

  loadAiSummary(): void {
    if (!this.selectedAffiliate || !this.selectedYear) return;
    this.aiLoading = true; this.aiSummary = ''; this.aiError = '';
    this.kpiService.getAiSummary(this.selectedAffiliate, this.selectedYear, 'ALL', this.selectedMonth || 'ALL').subscribe({
      next: (res) => {
        if (res.success) {
          this.aiSummary     = res.summary;
          this.aiSummaryHtml = this.sanitizer.bypassSecurityTrustHtml(this.markdownToHtml(res.summary));
        } else { this.aiError = 'Résumé IA non disponible.'; }
        this.aiLoading = false;
      },
      error: () => { this.aiError = 'Erreur IA.'; this.aiLoading = false; },
    });
  }

  private markdownToHtml(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<h4 class="ai-h">$1</h4>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>\n?)+/gs, m => `<ul class="ai-ul">${m}</ul>`)
      .replace(/\n{2,}/g, '<br><br>');
  }

  runForecast(): void {
    if (!this.selectedAffiliate) return;
    this.forecastLoading = true; this.forecastError = ''; this.forecastResult = null;
    this.forecastService.getForecast(this.selectedAffiliate, this.forecastKpi, [2023, 2024, 2025], 1).subscribe({
      next: (result: any) => {
        this.forecastLoading = false;
        if (result['error']) { this.forecastError = result['error']; return; }
        this.forecastResult = result;
      },
      error: (err: any) => { this.forecastLoading = false; this.forecastError = 'Erreur : ' + (err.message || 'Inconnue'); },
    });
  }

  formatForecastValue(value: number, kpi: string): string {
    if (value === null || value === undefined) return '--';
    if (kpi === 'Fleet_utilization_rate') return (value * 100).toFixed(1) + '%';
    if (kpi === 'Total_Fleet_OPEX_EUR')   return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' €';
    if (kpi === 'Total_volume_m3')        return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' m³';
    if (kpi === 'Distance_km')            return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' km';
    return new Intl.NumberFormat('fr-FR').format(Math.round(value));
  }

  // ── Mail ────────────────────────────────────────────────────
  showMailForm  = false;
  managerEmail  = 'manager.logistique@outlook.com';
  mailYear      = new Date().getFullYear().toString();
  dashboardUrl  = 'http://localhost:4200/login';
  sendingMail   = false;
  mailSuccess   = '';
  mailError     = '';

  toggleMailForm(): void {
    this.showMailForm = !this.showMailForm;
    this.mailSuccess  = '';
    this.mailError    = '';
  }

  sendMailToManager(): void {
    this.mailSuccess = ''; this.mailError = '';
    if (!this.managerEmail?.trim()) { this.mailError = 'Email du manager obligatoire.'; return; }
    this.sendingMail = true;
    this.mailService.sendDashboardReady({ to: this.managerEmail.trim(), year: this.mailYear, dashboardUrl: this.dashboardUrl }).subscribe({
      next: (res: any) => { this.mailSuccess = typeof res === 'string' ? res : 'Mail envoyé ✅'; this.sendingMail = false; this.showMailForm = false; },
      error: (err: any) => { this.mailError = err?.error || "Erreur lors de l'envoi ❌"; this.sendingMail = false; },
    });
  }

  openKpiChart(kpiCode: string): void {
    if (!kpiCode) return;
    this.modalTitle = `${this.prettyLabel(kpiCode)} — ${this.selectedYear}`;
    this.modalError = ''; this.showChartModal = true;
    this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, kpiCode)
      .subscribe({ next: (s) => this.renderTrendChart(s.labels, s.values, kpiCode), error: () => { this.modalError = 'Erreur chargement courbe.'; } });
  }

  closeKpiChart(): void { this.showChartModal = false; this.trendChart?.destroy(); this.trendChart = undefined; }

  private renderTrendChart(labels: string[], values: number[], kpiCode: string): void {
    this.trendChart?.destroy();
    const canvas = document.getElementById('kpiTrendChartMain') as HTMLCanvasElement;
    const ctx    = canvas?.getContext('2d');
    if (!ctx) return;
    const isRate = this.isRateKpi(kpiCode);
    const data   = isRate ? values.map(v => +(v * 100).toFixed(1)) : values;
    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: isRate ? `${this.prettyLabel(kpiCode)} (%)` : this.prettyLabel(kpiCode), data, tension: 0.35, borderWidth: 3, pointRadius: 4, borderColor: '#FF6B35', backgroundColor: 'rgba(255,107,53,0.15)', fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#fff', font: { weight: 700 as any } } }, tooltip: { callbacks: { label: (c: any) => isRate ? `${c.parsed?.y?.toFixed(1)}%` : new Intl.NumberFormat('fr-FR').format(c.parsed?.y) } } },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.70)', font: { weight: 600 as any } }, grid: { color: 'rgba(255,255,255,0.08)' } },
          y: { ticks: { color: 'rgba(255,255,255,0.70)', font: { weight: 600 as any }, callback: (v: any) => isRate ? `${v}%` : new Intl.NumberFormat('fr-FR').format(v) }, grid: { color: 'rgba(255,255,255,0.08)' } },
        },
      },
    });
  }

  prettyLabel(code: string): string { return (code || '').trim().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  isRateKpi(code: string): boolean { const c = (code || '').toLowerCase(); return c.includes('rate') || c.includes('compliance'); }
  formatValue(v: number, code: string): string { if (v === null || v === undefined) return '--'; if (this.isRateKpi(code)) return (v * 100).toFixed(1) + '%'; return new Intl.NumberFormat('fr-FR').format(v); }
  getKpiIcon(code: string): string { return KPI_ICONS[code] ?? KPI_ICONS[code?.trim()] ?? '📊'; }

  getTableStatusClass(code: string, value: number): string {
    const c = code.toLowerCase();
    if (c.includes('accident') || c.includes('spill'))     return value === 0 ? 'badge-ok' : 'badge-bad';
    if (c.includes('violation'))                            return value <= 2  ? 'badge-ok' : value <= 8 ? 'badge-warn' : 'badge-bad';
    if (c.includes('on_time') || c.includes('fleet_util')) return value >= 1.0 ? 'badge-ok' : 'badge-bad';
    if (c.includes('compliance'))                           return value >= 0.90 ? 'badge-ok' : value >= 0.75 ? 'badge-warn' : 'badge-bad';
    return 'badge-neutral';
  }

  getTableStatusLabel(code: string, value: number): string {
    const cls = this.getTableStatusClass(code, value);
    return cls === 'badge-ok' ? 'Normal' : cls === 'badge-warn' ? 'Attention' : cls === 'badge-bad' ? 'Critique' : 'Standard';
  }
}