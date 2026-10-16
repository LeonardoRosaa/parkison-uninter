import numpy as np
import pytest

import app.services.audio.correlation_dimension as correlation_dimension
import app.services.audio.dfa as dfa
import app.services.audio.rpde as rpde


def test_time_delay_embedding_builds_expected_vectors():
    x = np.array([1, 2, 3, 4, 5])

    embedded = rpde.time_delay_embedding(x, m=2, tau=2)

    expected = np.array([[1, 3], [2, 4], [3, 5]])
    np.testing.assert_array_equal(embedded, expected)


def test_close_return_periods_detects_first_valid_returns():
    Y = np.array([[0.0], [1.0], [0.0], [1.0]])

    periods = rpde.close_return_periods(Y, r=0.1)

    assert periods == [2, 2]


def test_rpde_returns_finite_normalized_value():
    y = np.sin(np.linspace(0, 20, 400))

    result = rpde.rpde(y)

    assert np.isfinite(result)
    assert 0.0 <= result <= 1.0


def test_dfa_returns_finite_scaling_exponent():
    rng = np.random.default_rng(seed=42)
    signal = rng.normal(size=300)

    result = dfa.dfa(signal)

    assert np.isfinite(result)


def test_correlation_sum_tree_counts_neighbors_with_theiler_window():
    Y = np.array([[0.0], [0.05], [1.0]])
    tree = correlation_dimension.KDTree(Y, leaf_size=2)

    no_theiler = correlation_dimension.correlation_sum_tree(tree, Y, r=0.1, theiler=0)
    with_theiler = correlation_dimension.correlation_sum_tree(tree, Y, r=0.1, theiler=1)

    assert no_theiler == pytest.approx(1.0 / 3.0)
    assert with_theiler == 0.0


def test_correlation_dimension_returns_finite_value():
    rng = np.random.default_rng(seed=7)
    y = rng.normal(size=400)

    result = correlation_dimension.correlation_dimension(
        y, m=3, tau=5, theiler=10, n_r=10
    )

    assert np.isfinite(result)


def test_correlation_dimension_returns_nan_when_not_enough_valid_points():
    y = np.ones(20)

    result = correlation_dimension.correlation_dimension(
        y, m=3, tau=7, theiler=10, n_r=20
    )

    assert np.isnan(result)
