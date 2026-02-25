import { Component, OnDestroy, OnInit } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { KpiService, ChartSeries } from 'src/app/services/kpi.service';

@Component({
  selector: 'app-graphes',
  templateUrl: './graphes.component.html',
  styleUrls: ['./graphes.component.scss']
})
export class GraphesComponent implements OnInit, OnDestroy {

  // ======= IMPORT state (comme dashboard) =======
  selectedFile: File | null = null;
  importing = false;
  importMsg = '';
  fileImported = false;

  // ======= Filters (comme dashboard) =======
  affiliates: string[] = [];
  years: number[] = [];
  categories: string[] = [];

  selectedAffiliate = '';
  selectedYear!: number;
  selectedCategory = 'ALL';

  // ======= UI state =======
  loading = false;
  errorMsg = '';
  showEmptyGraphs = true;

  // ======= NOUVEAU : type de graphique =======
  chartType: 'line' | 'bar' | 'pie' | 'doughnut' = 'line';

  // ======= NOUVEAU : flags de visibilité (cacher les cards vides) =======
  hasOtd      = false;
  hasVolume   = false;
  hasUnitCost = false;
  hasShe      = false;
  hasPayment  = false;

  // ======= Charts refs =======
  private otdChart?: Chart;
  private volumeChart?: Chart;
  private unitCostChart?: Chart;
  private sheChart?: Chart;
  private paymentChart?: Chart;

  // ======= Palette orange + couleurs pie =======
  private readonly ORANGE       = 'rgba(255,107,53,1)';
  private readonly ORANGE_FILL  = 'rgba(255,107,53,0.18)';
  private readonly BLUE         = 'rgba(59,130,246,1)';
  private readonly BLUE_FILL    = 'rgba(59,130,246,0.18)';
  private readonly PIE_COLORS   = [
    'rgba(255,107,53,0.85)',
    'rgba(247,147,30,0.85)',
    'rgba(251,191,36,0.85)',
    'rgba(52,211,153,0.85)',
    'rgba(96,165,250,0.85)',
    'rgba(167,139,250,0.85)',
    'rgba(251,113,133,0.85)',
    'rgba(34,211,238,0.85)',
    'rgba(163,230,53,0.85)',
    'rgba(248,113,113,0.85)',
    'rgba(217,70,239,0.85)',
    'rgba(20,184,166,0.85)',
  ];

  // options Chart.js communes (légende blanche, grille blanche)
  // isRate=true → axe Y en %, tooltip en %, labels pie en %
  private getOptions(isRate = false): any {
    const isPieOrDonut = this.chartType === 'pie' || this.chartType === 'doughnut';

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#ffffff', font: { weight: '700' } }
        },
        tooltip: {
          callbacks: isRate
            ? {
                label: (ctx: any) => {
                  const val = ctx.parsed?.y ?? ctx.parsed ?? 0;
                  const pct = val * 100;
                  // Adapte les décimales selon la taille de la valeur
                  const formatted = pct < 1 ? pct.toFixed(3) : pct < 10 ? pct.toFixed(2) : pct.toFixed(1);
                  return ` ${ctx.dataset.label}: ${formatted}%`;
                }
              }
            : {}
        }
      },
      scales: isPieOrDonut
        ? {}   // pas de scales pour pie/doughnut
        : {
            x: {
              ticks: { color: '#ffffff', font: { weight: '600' } },
              grid:  { color: 'rgba(255,255,255,0.15)' }
            },
            y: {
              ticks: {
                color: '#ffffff',
                font: { weight: '600' },
                ...(isRate
                  ? {
                      callback: (value: any) => {
                        const pct = value * 100;
                        // Si la valeur est très petite, on affiche des décimales
                        if (pct < 1)  return pct.toFixed(2) + '%';
                        if (pct < 10) return pct.toFixed(1) + '%';
                        return pct.toFixed(0) + '%';
                      }
                    }
                  : {})
              },
              grid: { color: 'rgba(255,255,255,0.15)' }
            }
          }
    };
  }

  constructor(private kpiService: KpiService) {}

  ngOnInit(): void {
    this.fileImported = false;
  }

  ngOnDestroy(): void {
    this.otdChart?.destroy();
    this.volumeChart?.destroy();
    this.unitCostChart?.destroy();
    this.sheChart?.destroy();
    this.paymentChart?.destroy();
  }

  // =========================
  // Import Excel (comme dashboard)
  // =========================
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    this.importMsg = '';
  }

  importExcel() {
    if (!this.selectedFile) return;

    this.importing = true;
    this.importMsg = '';
    this.errorMsg = '';
    this.showEmptyGraphs = true;

    this.kpiService.importKpis(this.selectedFile).subscribe({
      next: (msg) => {
        this.importMsg = msg;
        this.fileImported = true;
        this.loadInitialFilters();
        this.importing = false;
      },
      error: (err) => {
        console.error(err);
        this.importMsg = 'Erreur import Excel';
        this.importing = false;
      }
    });
  }

  private loadInitialFilters() {
    this.kpiService.getAffiliates().subscribe(a => {
      this.affiliates = a || [];
      if (!this.selectedAffiliate && this.affiliates.length > 0) {
        this.selectedAffiliate = this.affiliates[0];
      }
    });

    this.kpiService.getYears().subscribe(y => {
      this.years = y || [];
      if (!this.selectedYear && this.years.length > 0) {
        this.selectedYear = this.years[0];
      }
      if (this.selectedAffiliate && this.selectedYear) {
        this.loadCategories();
      }
    });
  }

  // =========================
  // Filters change handlers (comme dashboard)
  // =========================
  onAffiliateChange() {
    if (!this.selectedAffiliate || !this.selectedYear) return;
    this.loadCategories();
  }

  onYearChange() {
    if (!this.selectedAffiliate || !this.selectedYear) return;
    this.loadCategories();
  }

  private loadCategories() {
    this.kpiService.getCategories(this.selectedAffiliate, this.selectedYear).subscribe(c => {
      this.categories = c || [];
      this.selectedCategory = 'ALL';
    });
  }

  // =========================
  // Apply graphs  (logique INCHANGÉE — seul le rendu change)
  // =========================
  applyGraphs() {
    if (!this.selectedAffiliate || !this.selectedYear) return;

    this.loading = true;
    this.errorMsg = '';
    this.showEmptyGraphs = false;

    // Reset visibility flags
    this.hasOtd = this.hasVolume = this.hasUnitCost = this.hasShe = this.hasPayment = false;

    const CODES = {
      OTD:  'On_time_delivery_rate',
      VOL:  'Total_volume_m3',
      ACT:  'Unit_Cost_per_m3',
      PLAN: 'Plan_Unit_Cost_per_m3',
      PAY:  'Payment_incident_rate',
      CONT: 'Contamination_incidents',
      CROSS:'Cross_contamination_incidents'
    };

    const otd$  = this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, CODES.OTD,  this.selectedCategory);
    const vol$  = this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, CODES.VOL,  this.selectedCategory);
    const act$  = this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, CODES.ACT,  this.selectedCategory);
    const plan$ = this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, CODES.PLAN, this.selectedCategory);
    const pay$  = this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, CODES.PAY,  this.selectedCategory);
    const cont$ = this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, CODES.CONT, this.selectedCategory);
    const cross$= this.kpiService.getMonthlySeries(this.selectedAffiliate, this.selectedYear, CODES.CROSS,this.selectedCategory);

    otd$.subscribe({
      next: (otd) => {
        // Affiche uniquement si des valeurs non nulles existent
        if (this.hasData(otd)) {
          this.hasOtd = true;
          // setTimeout pour laisser Angular afficher le canvas avant de dessiner
          setTimeout(() => this.renderSingle('otdChart', otd, 'On-Time Delivery Rate', (c) => this.otdChart = c, this.otdChart, true));
        }

        vol$.subscribe({
          next: (vol) => {
            if (this.hasData(vol)) {
              this.hasVolume = true;
              setTimeout(() => this.renderSingle('volumeChart', vol, 'Total Volume M3', (c) => this.volumeChart = c, this.volumeChart));
            }

            act$.subscribe({
              next: (act) => {
                plan$.subscribe({
                  next: (plan) => {
                    if (this.hasData(act) || this.hasData(plan)) {
                      this.hasUnitCost = true;
                      setTimeout(() => this.renderBarActPlan('unitCostChart', act, plan));
                    }

                    pay$.subscribe({
                      next: (pay) => {
                        if (this.hasData(pay)) {
                          this.hasPayment = true;
                          setTimeout(() => this.renderSingle('paymentChart', pay, 'Payment Incident Rate', (c) => this.paymentChart = c, this.paymentChart, true));
                        }

                        cont$.subscribe({
                          next: (cont) => {
                            cross$.subscribe({
                              next: (cross) => {
                                const she = this.sumSeries(cont, cross);
                                if (this.hasData(she)) {
                                  this.hasShe = true;
                                  setTimeout(() => this.renderBarShe('sheChart', she, 'SHE Incidents', (c) => this.sheChart = c, this.sheChart));
                                }
                                this.loading = false;
                              },
                              error: () => this.failGraphs('Erreur chargement Cross contamination')
                            });
                          },
                          error: () => this.failGraphs('Erreur chargement Contamination')
                        });

                      },
                      error: () => this.failGraphs('Erreur chargement Payment')
                    });

                  },
                  error: () => this.failGraphs('Erreur chargement PLAN cost')
                });
              },
              error: () => this.failGraphs('Erreur chargement ACT cost')
            });

          },
          error: () => this.failGraphs('Erreur chargement Volume')
        });

      },
      error: () => this.failGraphs('Erreur chargement OTD')
    });
  }

  private failGraphs(msg: string) {
    this.errorMsg = msg;
    this.loading = false;
  }

  // =========================
  // Helper : est-ce que la série a des données ?
  // =========================
  private hasData(s: ChartSeries): boolean {
    return s && s.values && s.values.some(v => v !== null && v !== undefined && v !== 0);
  }

  // =========================
  // Helpers: sum series for SHE
  // =========================
  private sumSeries(a: ChartSeries, b: ChartSeries): ChartSeries {
    const mapB = new Map<string, number>();
    b.labels.forEach((l, i) => mapB.set(l, b.values[i] ?? 0));
    const labels = a.labels;
    const values = labels.map((l, i) => (a.values[i] ?? 0) + (mapB.get(l) ?? 0));
    return { labels, values };
  }

  // =========================
  // Rendu générique (line / bar / pie / doughnut)  — couleur ORANGE
  // isRate=true → axe Y et tooltip en pourcentage
  // =========================
  private renderSingle(
    canvasId: string,
    s: ChartSeries,
    label: string,
    setChart: (c: Chart) => void,
    oldChart?: Chart,
    isRate = false
  ) {
    oldChart?.destroy();
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const isPieOrDonut = this.chartType === 'pie' || this.chartType === 'doughnut';

    const dataset: any = isPieOrDonut
      ? {
          label,
          data: s.values,
          backgroundColor: this.PIE_COLORS.slice(0, s.labels.length),
          borderColor: 'rgba(255,255,255,0.3)',
          borderWidth: 2,
          hoverOffset: 8
        }
      : this.chartType === 'bar'
      ? {
          label,
          data: s.values,
          backgroundColor: this.ORANGE_FILL,
          borderColor: this.ORANGE,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }
      : {
          // line
          label,
          data: s.values,
          borderColor: this.ORANGE,
          backgroundColor: this.ORANGE_FILL,
          pointBackgroundColor: this.ORANGE,
          pointBorderColor: '#fff',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.4,
          fill: true
        };

    const c = new Chart(ctx, {
      type: this.chartType as any,
      data: { labels: s.labels, datasets: [dataset] },
      options: this.getOptions(isRate)
    });

    setChart(c);
  }

  // =========================
  // Rendu SHE — délègue à renderSingle
  // =========================
  private renderBarShe(
    canvasId: string,
    s: ChartSeries,
    label: string,
    setChart: (c: Chart) => void,
    oldChart?: Chart
  ) {
    this.renderSingle(canvasId, s, label, setChart, oldChart, false);
  }

  // =========================
  // Rendu ACT vs PLAN (2 datasets) — orange + bleu
  // =========================
  private renderBarActPlan(canvasId: string, act: ChartSeries, plan: ChartSeries) {
    this.unitCostChart?.destroy();
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const isPieOrDonut = this.chartType === 'pie' || this.chartType === 'doughnut';
    const type = isPieOrDonut ? 'bar' : this.chartType;

    const actDataset: any = type === 'bar'
      ? {
          label: 'ACT Unit Fleet Cost',
          data: act.values,
          backgroundColor: this.ORANGE_FILL,
          borderColor: this.ORANGE,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }
      : {
          label: 'ACT Unit Fleet Cost',
          data: act.values,
          borderColor: this.ORANGE,
          backgroundColor: this.ORANGE_FILL,
          pointBackgroundColor: this.ORANGE,
          pointBorderColor: '#fff',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.4,
          fill: false
        };

    const planDataset: any = type === 'bar'
      ? {
          label: 'PLAN Unit Fleet Cost',
          data: plan.values,
          backgroundColor: this.BLUE_FILL,
          borderColor: this.BLUE,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }
      : {
          label: 'PLAN Unit Fleet Cost',
          data: plan.values,
          borderColor: this.BLUE,
          backgroundColor: this.BLUE_FILL,
          pointBackgroundColor: this.BLUE,
          pointBorderColor: '#fff',
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.4,
          fill: false
        };

    this.unitCostChart = new Chart(ctx, {
      type: type as any,
      data: { labels: act.labels, datasets: [actDataset, planDataset] },
      options: this.getOptions(false)
    });
  }
}