// Tests for rating simulator pure functions.
// Pure math, zero external deps — fast & fully deterministic.

package logic

import (
	"math"
	"testing"

	"MCA-Maintenance/internal/models"
)

func abs(a, b float64) float64 { return math.Abs(a - b) }

// ─── CalculateEloExpected ───

func TestCalculateEloExpected_Symmetric(t *testing.T) {
	// 同分时期望胜率 0.5
	e := CalculateEloExpected(1200, 1200)
	if abs(e, 0.5) > 1e-9 {
		t.Fatalf("equal ratings expected 0.5, got %v", e)
	}
	// 分差对称性：E(A|B) + E(B|A) == 1
	a := CalculateEloExpected(1400, 1000)
	b := CalculateEloExpected(1000, 1400)
	if abs(a+b, 1.0) > 1e-9 {
		t.Fatalf("expected symmetric sum=1, got a=%v b=%v sum=%v", a, b, a+b)
	}
}

func TestCalculateEloExpected_LargeGap(t *testing.T) {
	// +800 分差应当在 ~0.99 左右（1/(1+10^-2) ≈ 0.9901）
	e := CalculateEloExpected(2000, 1200)
	if e < 0.95 {
		t.Fatalf("800-point advantage should yield a high expected win rate, got %v", e)
	}
}

// ─── GetKFactor ───

func TestGetKFactor_PlacementDecay(t *testing.T) {
	// 0 wins → KPlacementStart
	if k := GetKFactor(0); abs(k, KPlacementStart) > 1e-9 {
		t.Fatalf("0 wins expected KPlacementStart=%v, got %v", KPlacementStart, k)
	}
	// Placement 段应当严格递减
	prev := KPlacementStart + 1 // 确保第一个 (w=0) 能进入比较
	for w := 0; w < PlacementWinsThreshold; w++ {
		k := GetKFactor(w)
		if !(k < prev) {
			t.Fatalf("K factor should strictly decrease in placement (wins=%d, k=%v, prev=%v)", w, k, prev)
		}
		prev = k
	}
}

func TestGetKFactor_StabilityFloor(t *testing.T) {
	// 10 wins → stability 区间的中点
	mid := (KStabilityMin + KStabilityMax) / 2.0
	for _, w := range []int{PlacementWinsThreshold, PlacementWinsThreshold + 1, 100, 1000} {
		k := GetKFactor(w)
		if abs(k, mid) > 1e-9 {
			t.Fatalf("wins=%d expected stability midpoint %v, got %v", w, mid, k)
		}
	}
}

// ─── GetSurvivalWeight ───

func TestGetSurvivalWeight_Tiered(t *testing.T) {
	cases := []struct {
		s, i int
		want float64
	}{
		{0, 4, 1.00},    // 0% → <=0.25
		{1, 4, 1.00},    // 25% 边界 → <=0.25（闭区间）
		{2, 4, 1.05},    // 50% 边界 → <=0.5
		{3, 4, 1.15},    // 75% 边界 → <=0.75
		{4, 4, 1.25},    // 100% → >0.75
		{2, 8, 1.00},    // 2/8 = 0.25（<=0.25 闭区间）→ 1.00
		{3, 8, 1.05},    // 3/8 = 0.375 → <=0.5
	}
	for _, c := range cases {
		got := GetSurvivalWeight(c.s, c.i)
		if abs(got, c.want) > 1e-9 {
			t.Errorf("GetSurvivalWeight(%d, %d) = %v, want %v", c.s, c.i, got, c.want)
		}
	}
}

func TestGetSurvivalWeight_ZeroInitial(t *testing.T) {
	// initialCount<=0 → 始终 1.0
	for _, ic := range []int{0, -1, -100} {
		if got := GetSurvivalWeight(5, ic); got != 1.0 {
			t.Errorf("initialCount=%d → weight %v, want 1.0", ic, got)
		}
	}
}

// ─── GetStreakWeight ───

func TestGetStreakWeight_PositiveStreak(t *testing.T) {
	cases := []struct {
		streak int
		want  float64
	}{
		{0, 1.00}, {1, 1.00}, {2, 1.00},
		{3, 1.15}, {4, 1.15},
		{5, 1.28}, {100, 1.28},
	}
	for _, c := range cases {
		if got := GetStreakWeight(c.streak); abs(got, c.want) > 1e-9 {
			t.Errorf("GetStreakWeight(%d) = %v, want %v", c.streak, got, c.want)
		}
	}
}

func TestGetStreakWeight_NegativeStreak(t *testing.T) {
	cases := []struct {
		streak int
		want  float64
	}{
		{-1, 1.00}, {-2, 1.00},
		{-3, 0.85}, {-4, 0.85},
		{-5, 0.73}, {-100, 0.73},
	}
	for _, c := range cases {
		if got := GetStreakWeight(c.streak); abs(got, c.want) > 1e-9 {
			t.Errorf("GetStreakWeight(%d) = %v, want %v", c.streak, got, c.want)
		}
	}
}

// ─── GetIndividualPerformanceTweak ───

func TestGetIndividualPerformanceTweak_Clamp(t *testing.T) {
	if got := GetIndividualPerformanceTweak(0.5); got != 0.95 {
		t.Errorf("below floor clamped to %v, got %v", 0.95, got)
	}
	if got := GetIndividualPerformanceTweak(1.5); got != 1.05 {
		t.Errorf("above ceiling clamped to %v, got %v", 1.05, got)
	}
	if got := GetIndividualPerformanceTweak(1.0); got != 1.0 {
		t.Errorf("within range unchanged, got %v", got)
	}
	// 边界值：0.95 和 1.05 正好保留
	if got := GetIndividualPerformanceTweak(0.95); got != 0.95 {
		t.Errorf("exact floor boundary should remain 0.95, got %v", got)
	}
	if got := GetIndividualPerformanceTweak(1.05); got != 1.05 {
		t.Errorf("exact ceiling boundary should remain 1.05, got %v", got)
	}
}

// ─── SimulateRating 集成 ───

func TestSimulateRating_WinnerDeltaPositive(t *testing.T) {
	res := SimulateRating(models.RatingSimInput{
		PlayerRating:   1200,
		OpponentRating: 1200,
		WinsCount:      5,
		SurvivorCount:  1,
		InitialCount:   4,
		Streak:         0,
		Performance:    1.0,
		IsWinner:       true,
	})
	if res.Delta <= 0 {
		t.Fatalf("winner at equal rating should gain score, got delta=%d", res.Delta)
	}
	if abs(res.ExpectedWinRate, 0.5) > 1e-9 {
		t.Errorf("expected E=0.5, got %v", res.ExpectedWinRate)
	}
	// 对新手（placement K）来说，赢一盘分差 ~2500*0.5=250 左右（方向正确即可）
}

func TestSimulateRating_LoserDeltaNegative(t *testing.T) {
	res := SimulateRating(models.RatingSimInput{
		PlayerRating:   1200,
		OpponentRating: 1200,
		WinsCount:      5,
		SurvivorCount:  1,
		InitialCount:   4,
		Streak:         0,
		Performance:    1.0,
		IsWinner:       false,
	})
	if res.Delta >= 0 {
		t.Fatalf("loser at equal rating should lose score, got delta=%d", res.Delta)
	}
}

func TestSimulateRating_UnderdogWinnerGainsMore(t *testing.T) {
	// 低分挑战高分胜利，delta 应比同分时大
	same := SimulateRating(models.RatingSimInput{
		PlayerRating:   1000,
		OpponentRating: 1000,
		WinsCount:      15,
		SurvivorCount:  1,
		InitialCount:   4,
		Streak:         0,
		Performance:    1.0,
		IsWinner:       true,
	})
	upset := SimulateRating(models.RatingSimInput{
		PlayerRating:   800,
		OpponentRating: 1600,
		WinsCount:      15,
		SurvivorCount:  1,
		InitialCount:   4,
		Streak:         0,
		Performance:    1.0,
		IsWinner:       true,
	})
	if upset.Delta <= same.Delta {
		t.Errorf("upset win should yield larger delta (%d) than even match (%d)", upset.Delta, same.Delta)
	}
}

func TestSimulateRating_AllFieldsPopulated(t *testing.T) {
	res := SimulateRating(models.RatingSimInput{
		PlayerRating:   1000,
		OpponentRating: 1000,
		WinsCount:      0,
		SurvivorCount:  1,
		InitialCount:   4,
		Streak:         3,
		Performance:    0.9,
		IsWinner:       true,
	})
	// Performance 被 clamp 到 0.95
	if res.PerfWeight != 0.95 {
		t.Errorf("perf clamp not applied, got %v", res.PerfWeight)
	}
	// streak=3（>=+3）→ 1.15
	if res.StreakWeight != 1.15 {
		t.Errorf("streak weight wrong, got %v", res.StreakWeight)
	}
	// 1/4=0.25 → 1.00
	if res.SurvivalWeight != 1.00 {
		t.Errorf("survival weight wrong, got %v", res.SurvivalWeight)
	}
}
