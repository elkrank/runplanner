import { AfterViewInit, Component } from '@angular/core';
import { bootstrapLegacyApp, legacySetWeightRange, legacySwitchTab } from './app-legacy';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit {
  ngAfterViewInit(): void {
    bootstrapLegacyApp();
  }

  switchTab(tab: 'training' | 'sleep' | 'weight'): void {
    legacySwitchTab(tab);
  }

  setWeightRange(range: number): void {
    legacySetWeightRange(range);
  }
}
