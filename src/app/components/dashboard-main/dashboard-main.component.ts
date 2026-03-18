import { Component, OnInit, OnDestroy } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { KpiService, KpiValue, ChartSeries } from 'src/app/services/kpi.service';
import { Chart } from 'chart.js/auto';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// ── KPI icons ────────────────────────────────────────────────────────────────
const KPI_ICONS: Record<string, string> = {
  'On_time_delivery_rate':                          '🎯',
  'Delivery Truck Accident':                        '🚨',
  'Fleet_utilization_rate':                         '🚛',
  'Total_Fleet_OPEX_EUR':                           '💰',
  'Total_Fleet_OPEX_EUR ':                          '💰',
  'Number_of_deliveries':                           '📦',
  'Distance_km':                                    '🗺️',
  'Monthly Driver Violations':                      '⚠️',
  'Monthly Driver Violations ':                     '⚠️',
  'Driver_compliance_rate':                         '✅',
  'Unit_Cost_per_m3':                               '💲',
  'Number_of_trucks_operating_during_the_month':    '🔧',
  'Number_of_trucks_operating_during_the_month ':   '🔧',
  'Avg_hours_per_truck_per_day':                    '⏱️',
  'Number_of_working_days_in_the_month':            '📅',
  'Total_volume_m3':                                '📐',
  'Spill/Cross-Fuel Incident':                      '⛽',
  'Total Drivers':                                  '👤',
  'Total Drivers ':                                 '👤',
  'Total_trucks':                                   '🚚',
  'Planned_orders':                                 '📋',
  'Total_driving_hours':                            '🕐',
  'Total_hours_worked':                             '⏰',
  'Total_delivery_hours':                           '🚀',
  'Total_loading_hours':                            '⏳',
  'Number_of_loadings':                             '📤',
  'Delivery_delays_technical':                      '🔴',
  'Legal_12h_compliance':                           '⚖️',
};

export interface AnalyticsStat {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}

export interface ActivityItem {
  title: string;
  time: string;
  color: string;
  initials: string;
}

@Component({
  selector: 'app-dashboard-main',
  templateUrl: './dashboard-main.component.html',
  styleUrls: ['./dashboard-main.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('450ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class DashboardMainComponent implements OnInit, OnDestroy {

  // ── state ────────────────────────────────────────────────────────────────
  dashboardReady = false;
  loading        = false;
  errorMsg       = '';

  // ── import ───────────────────────────────────────────────────────────────
  selectedFile?: File;
  importing     = false;
  importMsg     = '';
  importError   = false;
  isDragOver    = false;

  // ── filters ──────────────────────────────────────────────────────────────
  affiliates:       string[] = [];
  years:            number[] = [];
  months:           string[] = [];
  selectedAffiliate = '';
  selectedYear!:    number;
  selectedMonth     = 'ALL';

  // ── data ─────────────────────────────────────────────────────────────────
  allKpis: KpiValue[] = [];
  tableSearch = '';

  // ── IA Summary ───────────────────────────────────────────────────────────
  aiSummary    = '';
  aiSummaryHtml: SafeHtml = '';
  aiLoading    = false;
  aiError      = '';

  // ── derived UI data ───────────────────────────────────────────────────────
  analyticsStats: AnalyticsStat[] = [];
  recentActivities: ActivityItem[] = [];
  fleetUtilization = 0;

  // ── charts ───────────────────────────────────────────────────────────────
  private lineChart?:   Chart;
  private barChart?:    Chart;
  private gaugeChart?:  Chart;
  private trendChart?:  Chart;

  // ── modal ─────────────────────────────────────────────────────────────────
  showChartModal = false;
  modalTitle     = '';
  modalError     = '';

  constructor(
    private kpiService: KpiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    [this.lineChart, this.barChart, this.gaugeChart, this.trendChart]
      .forEach(c => c?.destroy());
  }

  // ── drag/drop ─────────────────────────────────────────────────────────────
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

  // ── import ────────────────────────────────────────────────────────────────
  importExcel(): void {
    if (!this.selectedFile) return;
    this.importing = true; this.importMsg = ''; this.importError = false;
    this.kpiService.importKpis(this.selectedFile).subscribe({
      next: (res) => {
        this.importMsg      = res;
        this.importing      = false;
        this.dashboardReady = true;
        this.initFilters();
      },
      error: (e) => {
        this.importing   = false;
        this.importMsg   = e?.error || "Erreur lors de l'import.";
        this.importError = true;
      },
    });
  }

  resetImport(): void {
    this.dashboardReady = false;
    this.selectedFile   = undefined;
    this.importMsg      = '';
    this.importError    = false;
    this.allKpis        = [];
    [this.lineChart, this.barChart, this.gaugeChart]
      .forEach(c => c?.destroy());
  }

  // ── init filters ─────────────────────────────────────────────────────────
  private initFilters(): void {
    this.kpiService.getAffiliates().subscribe({
      next: (affs) => {
        this.affiliates        = affs || [];
        this.selectedAffiliate = this.affiliates[0] || '';
        this.kpiService.getYears().subscribe({
          next: (yrs) => {
            this.years        = yrs || [];
            this.selectedYear = this.years[0] || new Date().getFullYear();
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
        if (!this.months.includes(this.selectedMonth))
          this.selectedMonth = this.months[0] || 'ALL';
        this.applyDashboard();
      },
    });
  }

  onAffiliateChange(): void { this.loadMonths(); }
  onYearChange(): void      { this.loadMonths(); }

  // ── IA Summary ────────────────────────────────────────────────────────────
  loadAiSummary(): void {
    if (!this.selectedAffiliate || !this.selectedYear) return;
    this.aiLoading = true;
    this.aiSummary = '';
    this.aiError   = '';

    this.kpiService.getAiSummary(
      this.selectedAffiliate,
      this.selectedYear,
      'ALL',
      this.selectedMonth || 'ALL'
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.aiSummary     = res.summary;
          this.aiSummaryHtml = this.sanitizer.bypassSecurityTrustHtml(
            this.markdownToHtml(res.summary)
          );
        } else {
          this.aiError = 'Résumé IA non disponible.';
        }
        this.aiLoading = false;
      },
      error: () => {
        this.aiError   = 'Erreur lors de la génération du résumé IA.';
        this.aiLoading = false;
      },
    });
  }

  private markdownToHtml(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3} (.+)$/gm, '<h4 class="ai-h">$1</h4>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>\n?)+/gs, (match) => `<ul class="ai-ul">${match}</ul>`)
      .replace(/\n{2,}/g, '<br><br>');
  }

  scrollToAiSummary(): void {
    // Toujours régénérer avec les filtres actuels
    this.loadAiSummary();
    setTimeout(() => {
      document.getElementById('aiSummarySection')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }

  // ── apply ─────────────────────────────────────────────────────────────────
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
        this.buildDerivedData();
        setTimeout(() => this.drawAllCharts(), 120);
      },
      error: () => { this.errorMsg = 'Erreur lors du chargement.'; this.loading = false; },
    });
  }

  // ── derived data ──────────────────────────────────────────────────────────
  private getVal(code: string, source: KpiValue[] = this.allKpis): number {
    const k = source.find(k =>
      k.kpiCode.trim().toLowerCase() === code.trim().toLowerCase()
    );
    return k?.value ?? 0;
  }

  /** Retourne le mois précédent dans la liste des mois disponibles */
  private getPrevMonth(): string | null {
    if (this.selectedMonth === 'ALL') return null;
    const idx = this.months.indexOf(this.selectedMonth);
    return idx > 0 ? this.months[idx - 1] : null;
  }

  /** Formate un delta : +12.3% ou -2.1% ou '--' si pas de données */
  private formatDelta(current: number, previous: number): { text: string; positive: boolean } {
    if (!previous || previous === 0) return { text: '--', positive: true };
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const sign = pct >= 0 ? '+' : '';
    return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0 };
  }

  private buildDerivedData(): void {
    const otd       = this.getVal('On_time_delivery_rate');
    const delivs    = this.getVal('Number_of_deliveries');
    const opex      = this.getVal('Total_Fleet_OPEX_EUR');
    const fleetUtil = this.getVal('Fleet_utilization_rate');
    const dist      = this.getVal('Distance_km');

    this.fleetUtilization = Math.round(fleetUtil * 100);

    // Charger le mois précédent pour calculer les deltas réels
    const prevMonth = this.getPrevMonth();

    const buildStats = (prevKpis: KpiValue[]) => {
      const pOtd   = this.getVal('On_time_delivery_rate', prevKpis);
      const pDeliv = this.getVal('Number_of_deliveries', prevKpis);
      const pOpex  = this.getVal('Total_Fleet_OPEX_EUR', prevKpis);
      const pDist  = this.getVal('Distance_km', prevKpis);

      const dOtd   = this.formatDelta(otd,    pOtd);
      const dDeliv = this.formatDelta(delivs, pDeliv);
      const dOpex  = this.formatDelta(opex,   pOpex);
      const dDist  = this.formatDelta(dist,   pDist);

      this.analyticsStats = [
        {
          label: 'On-Time Delivery',
          value: (otd * 100).toFixed(1) + '%',
          delta: dOtd.text,
          positive: dOtd.positive,
        },
        {
          label: 'Nb Livraisons',
          value: new Intl.NumberFormat('fr-FR').format(delivs),
          delta: dDeliv.text,
          positive: dDeliv.positive,
        },
        {
          label: 'OPEX Flotte',
          value: opex > 0 ? '€' + new Intl.NumberFormat('fr-FR').format(Math.round(opex)) : '--',
          delta: dOpex.text,
          positive: dOpex.positive,
        },
        {
          label: 'Distance KM',
          value: dist > 0 ? new Intl.NumberFormat('fr-FR').format(Math.round(dist)) + ' km' : '--',
          delta: dDist.text,
          positive: dDist.positive,
        },
      ];
    };

    // Si mois précédent disponible → on le charge depuis l'API
    if (prevMonth) {
      this.kpiService.getKpis(this.selectedAffiliate, prevMonth, this.selectedYear)
        .subscribe({
          next: (prevData) => buildStats(prevData || []),
          error: ()        => buildStats([]),  // pas de données → deltas '--'
        });
    } else {
      // Mode ALL ou premier mois → deltas '--'
      buildStats([]);
    }

    // Recent activities (based on real KPI alerts)
    const accidents  = this.getVal('Delivery Truck Accident');
    const violations = this.getVal('Monthly Driver Violations');
    this.recentActivities = [
      {
        title: `${delivs > 0 ? Math.round(delivs) : '—'} livraisons enregistrées`,
        time: `${this.selectedMonth} ${this.selectedYear}`,
        color: '#4ade80',
        initials: 'LV',
      },
      {
        title: accidents > 0 ? `${accidents} accident(s) déclaré(s)` : 'Aucun accident ce mois',
        time: `${this.selectedMonth} ${this.selectedYear}`,
        color: accidents > 0 ? '#f87171' : '#4ade80',
        initials: 'AC',
      },
      {
        title: `${violations > 0 ? Math.round(violations) : '0'} infraction(s) chauffeur`,
        time: `${this.selectedMonth} ${this.selectedYear}`,
        color: violations > 2 ? '#fbbf24' : '#63b3ed',
        initials: 'IF',
      },
      {
        title: `Taux utilisation flotte: ${this.fleetUtilization}%`,
        time: `${this.selectedMonth} ${this.selectedYear}`,
        color: '#FF6B35',
        initials: 'FL',
      },
    ];
  }

  // ── filtered table KPIs ───────────────────────────────────────────────────
  get filteredTableKpis(): KpiValue[] {
    if (!this.tableSearch.trim()) return this.allKpis;
    const q = this.tableSearch.toLowerCase();
    return this.allKpis.filter(k =>
      k.kpiCode.toLowerCase().includes(q) || this.prettyLabel(k.kpiCode).toLowerCase().includes(q)
    );
  }

  // ── charts ────────────────────────────────────────────────────────────────
  private async drawAllCharts(): Promise<void> {
    await this.drawLineChart();
    await this.drawBarChart();
    this.drawGauge();
  }

  private async drawLineChart(): Promise<void> {
    this.lineChart?.destroy();
    const series = await this.fetchSeries('On_time_delivery_rate');
    const canvas = document.getElementById('analyticsLineChart') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const vals = series ? series.values.map(v => +(v * 100).toFixed(1)) : [];
    const labels = series?.labels ?? this.months;

    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'On-Time Delivery (%)',
            data: vals,
            tension: 0.45,
            borderWidth: 2.5,
            pointRadius: 2,
            pointHoverRadius: 5,
            borderColor: '#003087',
            backgroundColor: 'rgba(0,48,135,0.18)',
            pointBackgroundColor: '#003087',
            fill: true,
          },
        ],
      },
      options: this.compactLineOptions(),
    });
  }

  private async drawBarChart(): Promise<void> {
    this.barChart?.destroy();
    const series = await this.fetchSeries('Number_of_deliveries');
    const canvas = document.getElementById('analyticsBarChart') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: series?.labels ?? this.months,
        datasets: [{
          label: 'Livraisons',
          data: series?.values ?? [],
          borderRadius: 4,
          borderSkipped: false,
          backgroundColor: '#FF6B35',
          borderColor: '#FF6B35',
          borderWidth: 0,
        }],
      },
      options: this.compactBarOptions(),
    });
  }

  private drawGauge(): void {
    this.gaugeChart?.destroy();
    const val = this.fleetUtilization;
    const canvas = document.getElementById('gaugeChart') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const remaining = 100 - val;
    this.gaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [val, remaining],
          backgroundColor: [
            val >= 100 ? '#4ade80' : '#f87171',
            'rgba(255,255,255,0.06)',
          ],
          borderColor: 'transparent',
          borderWidth: 0,
          circumference: 240,
          rotation: 240,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '78%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  }

  private fetchSeries(kpiCode: string): Promise<ChartSeries | null> {
    return new Promise(resolve => {
      this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, kpiCode)
        .subscribe({ next: s => resolve(s), error: () => resolve(null) });
    });
  }

  private compactLineOptions(): any {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${c.parsed?.y?.toFixed(1)}%` } },
      },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.55)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: 'rgba(255,255,255,0.55)', font: { size: 10 }, callback: (v: any) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    };
  }

  private compactBarOptions(): any {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c: any) => `Livraisons: ${new Intl.NumberFormat('fr-FR').format(c.parsed?.y)}` } },
      },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.55)', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: 'rgba(255,255,255,0.55)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    };
  }

  // ── modal chart ───────────────────────────────────────────────────────────
  openKpiChart(kpiCode: string): void {
    this.modalTitle     = `${this.prettyLabel(kpiCode)} — ${this.selectedYear}`;
    this.modalError     = '';
    this.showChartModal = true;

    this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, kpiCode)
      .subscribe({
        next: (s) => this.renderTrendChart(s.labels, s.values, kpiCode),
        error: ()  => { this.modalError = 'Impossible de charger la courbe.'; },
      });
  }

  closeKpiChart(): void {
    this.showChartModal = false;
    this.trendChart?.destroy();
    this.trendChart = undefined;
  }

  private renderTrendChart(labels: string[], values: number[], kpiCode: string): void {
    this.trendChart?.destroy();
    const canvas = document.getElementById('kpiTrendChartMain') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const isRate = this.isRateKpi(kpiCode);
    const data   = isRate ? values.map(v => +(v * 100).toFixed(1)) : values;

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: isRate ? `${this.prettyLabel(kpiCode)} (%)` : this.prettyLabel(kpiCode),
          data,
          tension: 0.35, borderWidth: 3, pointRadius: 3,
          borderColor: '#FF6B35',
          backgroundColor: 'rgba(255,107,53,0.15)',
          fill: true,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#fff', font: { weight: 700 } } },
          tooltip: { callbacks: { label: (c: any) => isRate ? `${c.parsed?.y?.toFixed(1)}%` : new Intl.NumberFormat('fr-FR').format(c.parsed?.y) } },
        },
        scales: {
          x: { ticks: { color: '#fff', font: { weight: 700 } }, grid: { color: 'rgba(255,255,255,0.08)' } },
          y: { ticks: { color: '#fff', font: { weight: 700 }, callback: (v: any) => isRate ? `${v}%` : `${v}` }, grid: { color: 'rgba(255,255,255,0.08)' } },
        },
      },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  prettyLabel(code: string): string {
    return (code || '').trim().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  isRateKpi(code: string): boolean {
    const c = (code || '').toLowerCase();
    return c.includes('rate') || c.includes('compliance');
  }

  formatValue(v: number, code: string): string {
    if (v === null || v === undefined) return '--';
    if (this.isRateKpi(code)) return (v * 100).toFixed(1) + '%';
    return new Intl.NumberFormat('fr-FR').format(v);
  }

  getKpiIcon(code: string): string {
    return KPI_ICONS[code] ?? KPI_ICONS[code?.trim()] ?? '📊';
  }

  getTableStatusClass(code: string, value: number): string {
    const c = code.toLowerCase();
    if (c.includes('accident') || c.includes('spill'))   return value === 0 ? 'badge-ok' : 'badge-bad';
    if (c.includes('violation'))                          return value <= 2  ? 'badge-ok' : value <= 8 ? 'badge-warn' : 'badge-bad';
    if (c.includes('on_time') || c.includes('fleet_util')) return value >= 1.0 ? 'badge-ok' : 'badge-bad';
    if (c.includes('compliance'))                         return value >= 0.90 ? 'badge-ok' : value >= 0.75 ? 'badge-warn' : 'badge-bad';
    return 'badge-neutral';
  }

  getTableStatusLabel(code: string, value: number): string {
    const cls = this.getTableStatusClass(code, value);
    return cls === 'badge-ok' ? 'Normal' : cls === 'badge-warn' ? 'Attention' : cls === 'badge-bad' ? 'Critique' : 'Standard';
  }
}