package healthmetrics

import "testing"

func TestCompute(t *testing.T) {
	r := Compute(Input{Gender: "female", Age: 28, HeightCM: 165, WeightKG: 52})
	if r.BMI < 18 || r.BMI > 20 {
		t.Fatalf("bmi=%v", r.BMI)
	}
	if r.BMILevel != "正常" {
		t.Fatalf("level=%s", r.BMILevel)
	}
	if r.SuggestKcal <= 0 || r.BodyFatPct <= 0 {
		t.Fatalf("metrics incomplete: %+v", r)
	}
}
