import { DashboardComponent } from './components/dashboard/dashboard.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
// Composants d'authentification
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { LandingpageComponent } from './components/landingpage/landingpage.component';
import { AccueilComponent } from './components/accueil/accueil.component';
import { GraphesComponent } from './components/graphes/graphes.component';
const routes: Routes = [ 
  { path: '', component: LandingpageComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'accueil', component: AccueilComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'graphes', component: GraphesComponent },

   { path: '**', redirectTo: '' }];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
