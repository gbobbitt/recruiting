# MODELING & SIMULATION

from random import random
import numpy as np
import inspect

from models import Vector3

def propagate_velocity(time_step: float, position: Vector3, velocity: Vector3, other_position: Vector3, m_other: float) -> Vector3:
    """Propagate the velocity of the agent from `time` to `time + timeStep`."""
    # Use law of gravitation to update velocity
    r_self = np.array([position.x, position.y, position.z])
    v_self = np.array([velocity.x, velocity.y, velocity.z])
    r_other = np.array([other_position.x, other_position.y, other_position.z])

    r = r_self - r_other
    dvdt = -m_other * r / np.linalg.norm(r)**3
    v_self = v_self + dvdt * time_step

    return Vector3(v_self[0], v_self[1], v_self[2])

def propagate_position(time_step: float, position: Vector3, velocity: Vector3) -> Vector3:
    """Propagate the position of the agent from `time` to `time + timeStep`."""
    # Apply velocity to position
    r_self = np.array([position.x, position.y, position.z])
    v_self = np.array([velocity.x, velocity.y, velocity.z])

    r_self = r_self + v_self * time_step

    return Vector3(v_self[0], v_self[1], v_self[2])

def propagate_mass(mass: float) -> float:
    return mass

def identity[T](arg: T) -> T:
    return arg

def timestep_manager(velocity: Vector3) -> float:
    """Compute the length of the next simulation timeStep for the agent"""
    return 100

def time_manager(time: float, timeStep: float) -> float:
    """Compute the time for the next simulation step for the agent"""
    return time + timeStep



'''
Generate a schema of supported state managers.
'''

# List of supported state managers
_state_managers = [
    propagate_velocity,
    propagate_position,
    propagate_mass,
    identity,
    timestep_manager,
    time_manager
]

schema = []
for func in _state_managers:
    sig = inspect.signature(func)
    
    inputs = tuple({key : sig.parameters[key].annotation.__name__} for key in sig.parameters.keys())
    output_type = sig.return_annotation.__name__
    
    schema.append({
        'function_name': func.__name__,
        'inputs': inputs,
        'output_type': output_type
    })



'''
NOTE: Declare what agents should exist, what functions should be run to update their state, 
    and bind the consumed arguments and produced results to each other.

Query syntax:
- `<variableName>` will do a dictionary lookup of `variableName` in the current state of the agent
   the query is running for.
- prev!(<query>)` will get the value of `query` from the previous step of simulation.
- `agent!(<agentId>)` will get the most recent state produced by `agentId`.
- `<query>.<name>` will evaluate `query` and then look up `name` in the resulting dictionary.
'''

agents = {
    'Body1': [
        {
            'consumed': '''(
                prev!(timeStep),
                prev!(position),
                prev!(velocity),
                agent!(Body2).position,
                agent!(Body2).mass,
            )''',
            'produced': '''velocity''',
            'function': propagate_velocity,
        },
        {
            'consumed': '''(
                prev!(timeStep),
                prev!(position),
                velocity,
            )''',
            'produced': '''position''',
            'function': propagate_position,
        },
        {
            'consumed': '''(
                prev!(mass),
            )''',
            'produced': '''mass''',
            'function': propagate_mass,
        },
        {
            'consumed': '''(
                prev!(time),
                timeStep
            )''',
            'produced': '''time''',
            'function': time_manager,
        },
        {
            'consumed': '''(
                velocity,
            )''',
            'produced': '''timeStep''',
            'function': timestep_manager,
        }
    ],
    'Body2': [
        {
            'consumed': '''(
                prev!(timeStep),
                prev!(position),
                prev!(velocity),
                agent!(Body1).position,
                agent!(Body1).mass,
            )''',
            'produced': '''velocity''',
            'function': propagate_velocity,
        },
        {
            'consumed': '''(
                prev!(timeStep),
                prev!(position),
                velocity,
            )''',
            'produced': '''position''',
            'function': propagate_position,
        },
        {
            'consumed': '''(
                prev!(mass),
            )''',
            'produced': '''mass''',
            'function': propagate_mass,
        },
        {
            'consumed': '''(
                prev!(time),
                timeStep
            )''',
            'produced': '''time''',
            'function': time_manager,
        },
        {
            'consumed': '''(
                velocity,
            )''',
            'produced': '''timeStep''',
            'function': timestep_manager,
        }
    ]
}

# NOTE: initial values are set here. we intentionally separate the data from the functions operating on it.
data = {
    'Body1': {
        'timeStep': 0.01,
        'time': 0.0,
        'position': {'x': -0.73, 'y': 0, 'z': 0},
        'velocity': {'x': 0, 'y': -0.0015, 'z': 0},
        'mass': 1
    },
    'Body2': {
        'timeStep': 0.01,
        'time': 0.0,
        'position': {'x': 60.34, 'y': 0, 'z': 0},
        'velocity': {'x': 0, 'y': 0.13 , 'z': 0},
        'mass': 0.123
    }
}