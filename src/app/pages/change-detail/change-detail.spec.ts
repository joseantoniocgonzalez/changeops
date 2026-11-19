import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetail } from './change-detail';

describe('ChangeDetail', () => {
  let component: ChangeDetail;
  let fixture: ComponentFixture<ChangeDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangeDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangeDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
