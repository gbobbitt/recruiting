import { Button, Card, Flex, Heading, Separator, Table, TextField, } from '@radix-ui/themes';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Select from '@radix-ui/react-select';
import * as Form from '@radix-ui/react-form';
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import { Link } from 'react-router-dom';
import { Routes } from 'routes';
import _ from 'lodash';

// Profile data
type StateManagerFormData = {
  function: string;
  consumed: string;
  produced: string;
};

type AgentFormData = {
  id: string;
  state_managers: StateManagerFormData[];
}

type AgentInitialStateFormData = {
  position: {
    x: number;
    y: number;
    z: number;
  };
  velocity: {
    x: number;
    y: number;
    z: number;
  };
  mass: number;
};

type ProfileFormData = {
  agents: AgentFormData[];
}

type SimulationFormData = {
  initial_states: Record<string, AgentInitialStateFormData>;
}

type StateManagerSchema = {
  function_name: string;
  inputs: Record<string, string>[];
  output_type: string;
}

// Input data from the simulation
type AgentData = Record<string, Record<string, number>>;
type DataFrame = Record<string, AgentData>;
type DataPoint = [number, number, DataFrame];

// Output data to the plot
type PlottedAgentData = Record<string, number[]>;
type PlottedFrame = Record<string, PlottedAgentData>;

const StateManagerSchemaContext = createContext<StateManagerSchema[]>([]);

const App = () => {
  const [profiles, setProfiles] = useState<Record<string, ProfileFormData>>({});
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  
  const [simulations, setSimulations] = useState<Record<string, SimulationFormData>>({});
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null);

  const [stateManagerSchema, setStateManagerSchema] = useState<StateManagerSchema[]>([]);

  const handleProfileFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting profile form with data:', selectedProfile);
    if (!selectedProfile) return;

    async function saveProfile() {
      try {
        const response = await fetch(`http://localhost:8000/profile/${selectedProfile}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profiles[selectedProfile!]),
        });
        if (!response.ok) {
          throw new Error(`Failed to save profile: ${response.status}`);
        }
        console.log('Profile saved successfully');
      } catch (error) {
        console.error('Error saving profile:', error);
      }
    }

    saveProfile();
  }, [selectedProfile]);

  function onProfileChange(profileId: string) {
    if (profileId === "new") {
      profiles["new"] = { agents: [] };
    }
    setSelectedProfile(profileId);
  }

  useEffect(() => {
    // fetch functions when the component mounts
    let canceled = false;

    async function fetchStateManagers() {
      try {
        const response = await fetch('http://localhost:8000/schema/statemanagers');
        if (canceled) return;
        const data = await response.json();
        console.log('State manager schema:', data);
        setStateManagerSchema(data.state_managers);
      } catch (error) {
        console.error('Error fetching state managers:', error);
      }
    }

    fetchStateManagers();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    // fetch profiles when the component mounts
    let canceled = false;

    async function fetchProfiles() {
      try {
        const response = await fetch('http://localhost:8000/profiles');
        if (canceled) return;
        const data: Record<string, ProfileFormData> = await response.json();
        setProfiles(data);
        console.log('Profiles:', data);
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    }

    fetchProfiles();

    return () => {
      canceled = true;
    };
  }, []);

  // Store plot data in state.
  const [positionData, setPositionData] = useState<PlottedAgentData[]>([]);
  const [velocityData, setVelocityData] = useState<PlottedAgentData[]>([]);
  const [initialState, setInitialState] = useState<DataFrame>({});

  useEffect(() => {
    // fetch plot data when the component mounts
    let canceled = false;

    async function fetchSimulation() {
      try {
        // data should be populated from a POST call to the simulation server
        const response = await fetch(`http://localhost:8000/profile/${selectedProfile}/simulation/${selectedSimulation}`);
        if (canceled) return;
        const data: DataPoint[] = await response.json();
        const updatedPositionData: PlottedFrame = {};
        const updatedVelocityData: PlottedFrame = {};

        // NOTE: Uncomment to see the raw data in the console
        console.log('Data:', data);

        setInitialState(data[0][2]);

        const baseData = () => ({
          x: [],
          y: [],
          z: [],
          type: 'scatter3d',
          mode: 'lines+markers',
          marker: { size: 4 },
          line: { width: 2 },
        });

        data.forEach(([t0, t1, frame]) => {
          for (let [agentId, val] of Object.entries(frame)) {
              if (agentId == "time" || agentId == "timeStep") {
                continue;
              }
              let {position, velocity} = val;
              updatedPositionData[agentId] = updatedPositionData[agentId] || baseData();
              updatedPositionData[agentId].x.push(position.x);
              updatedPositionData[agentId].y.push(position.y);
              updatedPositionData[agentId].z.push(position.z);

              updatedVelocityData[agentId] = updatedVelocityData[agentId] || baseData();
              updatedVelocityData[agentId].x.push(velocity.x);
              updatedVelocityData[agentId].y.push(velocity.y);
              updatedVelocityData[agentId].z.push(velocity.z);
          }
        });
        setPositionData(Object.values(updatedPositionData));
        setVelocityData(Object.values(updatedVelocityData));
        console.log('Set plot data!');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    if (selectedSimulation) {
      fetchSimulation();
    }

    return () => {
      canceled = true;
    };
  }, [selectedSimulation]);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        margin: '0 auto',
      }}
    >
      {/* Flex: https://www.radix-ui.com/themes/docs/components/flex */}
      <Flex direction="column" m="4" width="100%" justify="center" align="center">
        <Heading as="h1" size="8" weight="bold" mb="4">
          Simulations
        </Heading>
        <Flex direction="row" width="100%" justify="center" mb="4" align="start">

          <Flex direction="column" mr="4" align="start" gap="2" style={{width: "600px"}}>
            <Select.Root onValueChange={onProfileChange}>
              <Select.Trigger>
                <Select.Value placeholder="Select a profile">
                  {/* {selectedProfile?.id === "new" ? "New profile" : selectedProfile?.id} */}
                </Select.Value>
                <Select.Icon />
              </Select.Trigger>
              <Select.Content position='popper'>
                <Select.Viewport>
                  <Select.Item value="new">
                    <Select.ItemText>
                        New profile
                    </Select.ItemText>
                  </Select.Item>
                  {Object.keys(profiles).map((id) => (
                    <Select.Item key={id} value={id}>
                      <Select.ItemText>{id}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Root>

            {selectedProfile && (
              <Card style={{width: "100%"}}>
                <ScrollArea.Root>
                  <ScrollArea.Viewport>
                    <Form.Root onSubmit={handleProfileFormSubmit}>
                      <Form.Field name="id" style={{margin: "10px"}}>
                        <Form.Label>Profile Name</Form.Label>
                        <TextField.Root
                          type="text"
                          id="id"
                          name="id"
                          value={selectedProfile}
                          onChange={(e) => setSelectedProfile(e.target.value)}
                          required
                        />
                      </Form.Field>
                      <StateManagerSchemaContext.Provider value={stateManagerSchema}>
                        {selectedProfile && profiles[selectedProfile]?.agents.map((actor, index) => (
                          <ActorForm key={actor.id} actor={actor} style={{margin: "10px"}}
                            updatedActor={(updatedActor) => {
                              const updatedProfiles = {...profiles};
                              updatedProfiles[selectedProfile].agents[index] = updatedActor;
                              setProfiles(updatedProfiles);
                            }} />
                        ))}
                      </StateManagerSchemaContext.Provider>
                      <Button type="button" onClick={() => {
                        const newAgent: AgentFormData = {
                          id: `Body${profiles[selectedProfile].agents.length + 1}`,
                          state_managers: [],
                        };
                        profiles[selectedProfile].agents.push(newAgent);
                        setProfiles({...profiles});
                      }}>
                        Add Agent
                      </Button>
                      <Form.Submit asChild>
                        <Button>Save</Button>
                      </Form.Submit>
                    </Form.Root>
                  </ScrollArea.Viewport>
                </ScrollArea.Root>
              </Card>
            )}
          </Flex>

          <Flex direction="column" width="100%" justify="end" align="stretch">
            <Plot
              style={{ width: '45%', height: '100%', margin: '5px' }}
              data={positionData}
              layout={{
                title: 'Position',
                scene: {
                  xaxis: { title: 'X' },
                  yaxis: { title: 'Y' },
                  zaxis: { title: 'Z' },
                },
                autosize: true,
                dragmode: 'turntable',
              }}
              useResizeHandler
              config={{
                scrollZoom: true,
              }}
            />
            <Plot
              style={{ width: '45%', height: '100%', margin: '5px' }}
              data={velocityData}
              layout={{
                title: 'Velocity',
                scene: {
                  xaxis: { title: 'X' },
                  yaxis: { title: 'Y' },
                  zaxis: { title: 'Z' },
                },
                autosize: true,
                dragmode: 'turntable',
              }}
              useResizeHandler
              config={{
                scrollZoom: true,
              }}
            />
          </Flex>
        </Flex>
      </Flex>
    </div>
  );
};

const ActorForm = forwardRef(
    ({actor, updatedActor, ...props}: {actor: AgentFormData, updatedActor: (updatedActor: AgentFormData) => void}, ref: any) => {

  return (
    <Card ref={ref} style={{width: "100%"}} {...props}>
      <Form.Field name={`${actor.id}`} style={{margin: "10px"}}>
        <Form.Control asChild>
          <TextField.Root name={`${actor.id}`} value={actor.id} />
        </Form.Control>
      </Form.Field>
      {actor.state_managers.map((sm, index) => (
        <StateManagerForm key={`${actor.id}-${index}`} index={`${actor.id}-${index}`} sm={sm} style={{margin: "10px"}}
          updatedStateManager={(updatedSM) => {
            const updatedSMs = [...actor.state_managers];
            updatedSMs[index] = updatedSM;
            updatedActor({...actor, state_managers: updatedSMs});
          }} />
      ))}
      <Button type="button" onClick={() => {
        const newSM: StateManagerFormData = {
          function: '',
          consumed: '',
          produced: '',
        };
        actor.state_managers.push(newSM);
        updatedActor({...actor});
      }}>
        Add State Manager
      </Button>
    </Card>
  );
});

const StateManagerForm = forwardRef(
    ({index, sm, updatedStateManager, ...props}: {index: string, sm: StateManagerFormData, updatedStateManager: (updatedSM: StateManagerFormData) => void}, ref: any) => {

  const stateManagerSchema = useContext(StateManagerSchemaContext);

  function setFunction(funcName: string) {
    const updatedSM = {...sm, function: funcName};
    updatedStateManager(updatedSM);
  }

  function getConsumedParts() {
    const consumedStr = sm.consumed.trim();
    const inner = RegExp(/^\((.*)\)$/).exec(consumedStr);
    if (inner && inner[1]) {
      return inner[1].split(',').map(s => s.trim());
    }

    return [];
  }

  function getConsumedPart(index: number) {
    const consumedParts = getConsumedParts();
    return consumedParts[index] || '';
  }

  function setConsumedPart(consumed: string, index: number) {
    const consumedParts = getConsumedParts();
    consumedParts[index] = consumed;
    const updatedConsumed = `(${consumedParts.join(', ')})`;
    const updatedSM = {...sm, consumed: updatedConsumed};
    updatedStateManager(updatedSM);
  }

  function setProduced(produced: string) {
    const updatedSM = {...sm, produced};
    updatedStateManager(updatedSM);
  }

  return (
    <Card ref={ref} {...props}>
      <Form.Field name={`stateManager-${index}-function`} style={{margin: "10px"}}>
        <Form.Control asChild>
          <Select.Root onValueChange={setFunction}>
            <Select.Trigger>
              <Select.Value placeholder="Select a function" />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content position='popper'>
              <Select.Viewport>
                {stateManagerSchema.map((schema) => (
                  <Select.Item key={`${schema.function_name}-${index}`} value={schema.function_name}>
                    <Select.ItemText>{schema.function_name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Root>
        </Form.Control>
      </Form.Field>

      {stateManagerSchema.find((schema) => schema.function_name === sm.function)?.inputs.map((input, inputIndex) => (
        <Form.Field key={`${index}-input-${inputIndex}`} name={`stateManager-${index}-input-${inputIndex}`} style={{margin: "10px"}}>
          <Form.Label>{Object.keys(input)[0]} <i>{input[Object.values(input)[0]]}</i></Form.Label>
          <Form.Control asChild>
            <TextField.Root
              name={`stateManager-${index}-input-${inputIndex}`}
              defaultValue={getConsumedPart(inputIndex)}
              onChange={(e) => setConsumedPart(e.target.value, inputIndex)}
            />
          </Form.Control>
        </Form.Field>
      ))}

      {stateManagerSchema.find((schema) => schema.function_name === sm.function) && (
        <Form.Field name={`stateManager-produced-${index}`}>
          <Form.Label>Produced</Form.Label>
          <Form.Control asChild>
            <TextField.Root
              name={`stateManager-produced-${index}`}
              defaultValue={sm.produced}
              onChange={(e) => setProduced(e.target.value)}
            />
          </Form.Control>
        </Form.Field>
      )}
    </Card>
  );
});

export default App;
