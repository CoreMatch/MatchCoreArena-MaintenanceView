package logic

import (
	"math"
	"MCA-Maintenance/internal/models"
)

const (
	PlacementWinsThreshold = 10
	KPlacementStart        = 520.0
	KPlacementEnd          = 390.0
	KStabilityMin          = 165.0
	KStabilityMax          = 215.0
)

func CalculateEloExpected(playerRating, opponentRating float64) float64 {
	return 1.0 / (1.0 + math.Pow(10, (opponentRating-playerRating)/400.0))
}

func GetKFactor(wins int) float64 {
	if wins < PlacementWinsThreshold {
		n := float64(wins + 1)
		N := float64(PlacementWinsThreshold)
		return KPlacementStart - (n-1)*(KPlacementStart-KPlacementEnd)/(N-1)
	}
	return (KStabilityMin + KStabilityMax) / 2.0
}

func GetSurvivalWeight(survivorCount, initialCount int) float64 {
	if initialCount <= 0 {
		return 1.0
	}
	rate := float64(survivorCount) / float64(initialCount)
	switch {
	case rate <= 0.25:
		return 1.00
	case rate <= 0.5:
		return 1.05
	case rate <= 0.75:
		return 1.15
	default:
		return 1.25
	}
}

func GetStreakWeight(streak int) float64 {
	absStreak := int(math.Abs(float64(streak)))
	if streak >= 0 {
		switch {
		case absStreak <= 2:
			return 1.00
		case absStreak <= 4:
			return 1.15
		default:
			return 1.28
		}
	} else {
		switch {
		case absStreak <= 2:
			return 1.00
		case absStreak <= 4:
			return 0.85
		default:
			return 0.73
		}
	}
}

func GetIndividualPerformanceTweak(perf float64) float64 {
	if perf < 0.95 {
		return 0.95
	}
	if perf > 1.05 {
		return 1.05
	}
	return perf
}

func SimulateRating(input models.RatingSimInput) models.RatingSimResult {
	e := CalculateEloExpected(input.PlayerRating, input.OpponentRating)
	k := GetKFactor(input.WinsCount)
	wRound := GetSurvivalWeight(input.SurvivorCount, input.InitialCount)
	wStreak := GetStreakWeight(input.Streak)
	wPerf := GetIndividualPerformanceTweak(input.Performance)

	s := 0.0
	if input.IsWinner {
		s = 1.0
	}

	delta := k * (s - e) * wRound * wStreak * wPerf
	
	return models.RatingSimResult{
		Delta:           int(math.Round(delta)),
		ExpectedWinRate: e,
		KFactor:         k,
		SurvivalWeight:  wRound,
		StreakWeight:    wStreak,
		PerfWeight:      wPerf,
	}
}
