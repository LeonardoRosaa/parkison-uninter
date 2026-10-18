from app.services.audio.classifier import out_of_range_features

RANGES = {"DFA": (0.5, 0.8), "HNR": (4.0, 34.0)}


def test_values_inside_the_training_range_are_not_flagged():
    assert out_of_range_features({"DFA": 0.65, "HNR": 20.0}, RANGES) == []


def test_values_just_past_the_range_are_tolerated_by_the_margin():
    # DFA's range is 0.3 wide, so a 10% margin allows 0.47 to 0.83.
    assert out_of_range_features({"DFA": 0.48, "HNR": 20.0}, RANGES, margin=0.1) == []
    assert out_of_range_features({"DFA": 0.82, "HNR": 20.0}, RANGES, margin=0.1) == []


def test_values_far_past_the_range_are_named():
    values = {"DFA": 0.33, "HNR": 45.0}

    assert out_of_range_features(values, RANGES, margin=0.1) == ["DFA", "HNR"]


def test_values_that_are_not_finite_are_named():
    values = {"DFA": float("nan"), "HNR": float("inf")}

    assert out_of_range_features(values, RANGES) == ["DFA", "HNR"]
