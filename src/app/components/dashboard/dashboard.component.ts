import { Component, OnInit } from '@angular/core';
import { KpiService, KpiValue } from 'src/app/services/kpi.service';

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
  categories: string[] = []; // ✅ categories from backend (without ALL)

  // --- selected values ---
  selectedAffiliate = '';
  selectedYear!: number;
  selectedMonth = '';
  selectedCategory = 'ALL'; // ✅ UI value

  // --- dashboard data ---
  kpis: KpiValue[] = [];

  loading = false;
  errorMsg = '';
  fileImported = false;

  constructor(private kpiService: KpiService) {}

ngOnInit(): void {
  // ✅ On ne charge pas les filtres tant que le fichier n’est pas importé
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

            // ✅ Now that affiliate+year are known -> load months + categories
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
        // pick first month if current not available
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
        // backend returns categories (without ALL)
        this.categories = (cs || []).filter(x => !!x && x.trim().length > 0);

        // reset selected category to ALL each time filters change
        this.selectedCategory = 'ALL';

        // ✅ Debug
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

    // reload months + categories for new affiliate
    this.loadMonths();
    this.loadCategories();
  }

  onYearChange(): void {
    this.kpis = [];
    this.errorMsg = '';

    // reload months + categories for new year
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

  // ✅ si Month = ALL -> moyenne
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
    // ✅ sinon -> KPI mensuels
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
excludedFromAverage: string[] = [
  'Days_per_month'
];
shouldDisplayKpi(kpiCode: string): boolean {
  // si Month = ALL (AVG) et KPI exclu -> ne pas afficher
  if (this.selectedMonth === 'ALL' && this.excludedFromAverage.includes(kpiCode)) {
    return false;
  }
  return true;
}
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

  this.fileImported = true;  // ✅ MAINTENANT on affiche filtres + KPI
  this.initFilters();        // ✅ charger les listes (pays/année/mois/cat)

  // (optionnel) vider les KPI jusqu’à ce que tu cliques Appliquer
  this.kpis = [];
},

   error: (e) => {
  console.error(e);
  this.importing = false;
  this.importMsg = e?.error || "Erreur lors de l'import.";
  this.fileImported = false; // ✅ reste caché
}

  });
}


}
