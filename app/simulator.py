# SIMULATOR

from functools import reduce
from operator import __or__

from models import ActorStateDTO
from simulationgraph import SimulationGraph
from store import QRangeStore


class Simulator:
    """
    A Simulator is used to simulate the propagation of agents in the universe.
    This class is *not* pure. It mutates the data store in place and maintains internal state.

    It is given an initial state of the following form:
    ```
    {
        'agentId': {
            'time': <time of instantiation>,
            'timeStep': <time step for propagation>,
            **otherSimulatedProperties,
        },
        **otherAgents,
    }
    ```

    Args:
        store (QRangeStore): The data store in which to save the simulation results.
        init (dict): The initial state of the universe.
    """

    def __init__(self, store: QRangeStore, sim_graph: SimulationGraph, initial_states: dict[str, ActorStateDTO]):
        self.sim_graph = sim_graph
        self.store = store
        store[-999999999, 0] = initial_states
        self.states = { 
            actorId: {
                "position": actorState.position,
                "velocity": actorState.velocity,
                "mass": actorState.mass,
                "time": 0,
                "timeStep": 0.01,
            }
                
            for actorId, actorState in initial_states.items() 
        }

    def read(self, t):
        try:
            data = self.store[t]
        except IndexError:
            data = []
        return reduce(__or__, data, {}) # combine all data into one dictionary

    def simulate(self, iterations: int = 500):
        """Simulate the universe for a given number of iterations."""
        for _ in range(iterations):
            for agentId, state in self.states.items():
                t = state["time"]
                universe = self.read(t - 0.001)
                if set(universe) == set(self.states):
                    newState = self.sim_graph.step(agentId, universe)
                    self.store[t, newState[agentId]["time"]] = newState
                    # self.times[agentId] = newState[agentId]["time"]
