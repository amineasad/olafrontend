import { Component, OnInit } from '@angular/core';
import { KpiService, KpiValue } from 'src/app/services/kpi.service';
import { MailService } from 'src/app/services/mail.service'; // ✅ AJOUT

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  // --- dropdown data ---
  affiliates: string[] = [];
  years: number[] = [];
  months: string[] = [];
  categories: string[] = [];

  // --- selected values ---
  selectedAffiliate = '';
  selectedYear!: number;
  selectedMonth = '';
  selectedCategory = 'ALL';

  // --- dashboard data ---
  kpis: KpiValue[] = [];

  loading = false;
  errorMsg = '';
  fileImported = false;

  constructor(
    private kpiService: KpiService,
    private mailService: MailService // ✅ AJOUT
  ) {}

  ngOnInit(): void {
    this.fileImported = false;
  }

  // -------------------------
  // Init load (affiliates + years)
  // -------------------------
  private initFilters(): void {
    this.errorMsg = '';

    this.kpiService.getAffiliates().subscribe({
      next: (affs) => {
        this.affiliates = affs || [];
        this.selectedAffiliate = this.affiliates[0] || '';

        this.kpiService.getYears().subscribe({
          next: (yrs) => {
            this.years = yrs || [];
            this.selectedYear = this.years[0] || new Date().getFullYear();

            this.loadMonths();
            this.loadCategories();
          },
          error: (e) => {
            console.error(e);
            this.errorMsg = 'Erreur chargement années.';
          }
        });
      },
      error: (e) => {
        console.error(e);
        this.errorMsg = 'Erreur chargement pays.';
      }
    });
  }

  // -------------------------
  // Load months based on affiliate+year
  // -------------------------
  loadMonths(): void {
    if (!this.selectedAffiliate || !this.selectedYear) return;

    this.kpiService.getMonths(this.selectedAffiliate, this.selectedYear).subscribe({
      next: (ms) => {
        this.months = ms || [];
        if (!this.months.includes(this.selectedMonth)) {
          this.selectedMonth = this.months[0] || '';
        }
      },
      error: (e) => {
        console.error(e);
        this.errorMsg = 'Erreur chargement mois.';
      }
    });
  }

  // -------------------------
  // Load categories based on affiliate+year
  // -------------------------
  loadCategories(): void {
    if (!this.selectedAffiliate || !this.selectedYear) return;

    this.kpiService.getCategories(this.selectedAffiliate, this.selectedYear).subscribe({
      next: (cs) => {
        this.categories = (cs || []).filter(x => !!x && x.trim().length > 0);
        this.selectedCategory = 'ALL';
        console.log('Loaded categories:', this.categories);
      },
      error: (e) => {
        console.error(e);
        this.errorMsg = 'Erreur chargement catégories.';
      }
    });
  }

  // -------------------------
  // Events when user changes affiliate/year
  // -------------------------
  onAffiliateChange(): void {
    this.kpis = [];
    this.errorMsg = '';
    this.loadMonths();
    this.loadCategories();
  }

  onYearChange(): void {
    this.kpis = [];
    this.errorMsg = '';
    this.loadMonths();
    this.loadCategories();
  }

  // -------------------------
  // Apply button -> load KPI
  // -------------------------
  apply(): void {
    this.errorMsg = '';

    if (!this.selectedAffiliate || !this.selectedYear || !this.selectedMonth) {
      this.errorMsg = 'Veuillez sélectionner Pays, Année et Mois.';
      return;
    }

    this.loading = true;

    const categoryParam =
      (this.selectedCategory === 'ALL') ? undefined : this.selectedCategory;

    if (this.selectedMonth === 'ALL') {
      this.kpiService.getKpisAverage(this.selectedAffiliate, this.selectedYear, categoryParam)
        .subscribe({
          next: (data) => {
            this.kpis = (data || []).sort((a, b) => a.kpiCode.localeCompare(b.kpiCode));
            this.loading = false;
          },
          error: (e) => {
            console.error(e);
            this.loading = false;
            this.errorMsg = 'Erreur chargement KPI (Average).';
          }
        });

    } else {
      this.kpiService.getKpis(this.selectedAffiliate, this.selectedMonth, this.selectedYear, categoryParam)
        .subscribe({
          next: (data) => {
            this.kpis = (data || []).sort((a, b) => a.kpiCode.localeCompare(b.kpiCode));
            this.loading = false;
          },
          error: (e) => {
            console.error(e);
            this.loading = false;
            this.errorMsg = 'Erreur chargement KPI.';
          }
        });
    }
  }

  // -------------------------
  // Helpers UI
  // -------------------------
  prettyLabel(code: string): string {
    return (code || '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  isRate(code: string): boolean {
    const c = (code || '').toLowerCase();
    return c.includes('rate') || c.includes('compliance');
  }

  formatValue(v: number, code: string): string {
    if (v === null || v === undefined) return '--';
    if (this.isRate(code)) return (v * 100).toFixed(1) + '%';
    return new Intl.NumberFormat('fr-FR').format(v);
  }

  // KPI à NE PAS afficher quand on est en AVG
  excludedFromAverage: string[] = ['Days_per_month'];

  shouldDisplayKpi(kpiCode: string): boolean {
    if (this.selectedMonth === 'ALL' && this.excludedFromAverage.includes(kpiCode)) {
      return false;
    }
    return true;
  }

  // -------------------------
  // IMPORT
  // -------------------------
  selectedFile?: File;
  importMsg = '';
  importing = false;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.importMsg = `Fichier sélectionné : ${this.selectedFile.name}`;
    }
  }

  importExcel() {
    if (!this.selectedFile) {
      this.importMsg = 'Veuillez sélectionner un fichier Excel.';
      return;
    }

    this.importing = true;
    this.importMsg = '';

    this.kpiService.importKpis(this.selectedFile).subscribe({
      next: (res) => {
        this.importMsg = res;
        this.importing = false;

        this.fileImported = true;
        this.initFilters();
        this.kpis = [];
      },

      error: (e) => {
        console.error(e);
        this.importing = false;
        this.importMsg = e?.error || "Erreur lors de l'import.";
        this.fileImported = false;
      }
    });
  }

  // =================================================
  // 📧 MAIL (AJOUT MINIMAL)
  // =================================================
  showMailForm = false;
  managerEmail = 'manager.logistique@outlook.com';
  mailYear = new Date().getFullYear().toString();
  dashboardUrl = 'http://localhost:4200/login';

  sendingMail = false;
  mailSuccess = '';
  mailError = '';

  toggleMailForm(): void {
    this.showMailForm = !this.showMailForm;
    this.mailSuccess = '';
    this.mailError = '';
  }

  sendMailToManager(): void {
    this.mailSuccess = '';
    this.mailError = '';

    if (!this.managerEmail || !this.managerEmail.trim()) {
      this.mailError = 'Email du manager obligatoire.';
      return;
    }

    this.sendingMail = true;

    this.mailService.sendDashboardReady({
      to: this.managerEmail.trim(),
      year: this.mailYear,
      dashboardUrl: this.dashboardUrl
    }).subscribe({
      next: (res: any) => {
        this.mailSuccess = typeof res === 'string' ? res : 'Mail envoyé ✅';
        this.sendingMail = false;
      },
      error: (err) => {
        this.mailError = err?.error || "Erreur lors de l'envoi ❌";
        this.sendingMail = false;
      }
    });
  }
}
