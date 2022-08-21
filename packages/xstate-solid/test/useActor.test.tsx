/* @jsxImportSource solid-js */
import { useMachine, useActor } from '../src';
import {
  createMachine,
  sendParent,
  assign,
  spawn,
  ActorRef,
  ActorRefFrom,
  interpret
} from 'xstate';
import { fireEvent, screen, render } from 'solid-testing-library';
import { toActorRef } from 'xstate/lib/Actor';
import {
  Accessor,
  Component,
  createEffect,
  createSignal,
  on,
  onMount
} from 'solid-js';

describe('useActor', () => {
  it('initial invoked actor should be immediately available', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {}
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state] = useActor(props.actor);

      expect(state().value).toEqual('active');
      done();

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      return (
        <ChildTest
          actor={state.children.child as ActorRefFrom<typeof childMachine>}
        />
      );
    };

    render(() => <Test />);
  });

  it('invoked actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent({ type: 'FINISH' }) }
          }
        }
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state, send] = useActor(props.actor);

      onMount(() => {
        expect(state().value).toEqual('active');
        send({ type: 'FINISH' });
      });

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      createEffect(() => {
        if (state.matches('success')) {
          done();
        }
      });

      return (
        <ChildTest
          actor={state.children.child as ActorRefFrom<typeof childMachine>}
        />
      );
    };

    render(() => <Test />);
  });

  it('should only trigger effects once for nested context values', (done) => {
    const childMachine = createMachine<{
      item: { count: number; total: number };
    }>({
      id: 'childMachine',
      initial: 'active',
      context: {
        item: {
          count: 0,
          total: 0
        }
      },
      states: {
        active: {
          on: {
            FINISH: {
              actions: [
                assign({
                  item: (ctx) => ({ ...ctx.item, total: ctx.item.total + 1 })
                }),

                sendParent({ type: 'FINISH' })
              ]
            },
            COUNT: {
              actions: [
                assign({
                  item: (ctx) => ({ ...ctx.item, count: ctx.item.count + 1 })
                })
              ]
            }
          }
        }
      }
    });
    const machine = createMachine<{
      actorRef?: ActorRefFrom<typeof childMachine>;
    }>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          }),
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest = (props: {
      actor: Readonly<ActorRefFrom<typeof childMachine>>;
    }) => {
      const [state, send] = useActor(props.actor);
      const [count, setCount] = createSignal(0);
      const [total, setTotal] = createSignal(0);
      createEffect(
        on(
          () => state().context.item.count,
          () => {
            setCount(() => count() + 1);
          },
          { defer: true }
        )
      );

      createEffect(
        on(
          () => state().context.item.total,
          () => {
            setTotal(() => total() + 1);
          },
          { defer: true }
        )
      );

      onMount(() => {
        send({ type: 'COUNT' });
        send({ type: 'FINISH' });
      });

      return (
        <div>
          <div data-testid="count">{count()}</div>
          <div data-testid="total">{total()}</div>
        </div>
      );
    };

    const Test = () => {
      const [state] = useMachine(machine);

      return <ChildTest actor={state.context.actorRef!} />;
    };

    render(() => <Test />);
    const countEl = screen.getByTestId('count');
    const totalEl = screen.getByTestId('total');

    // Effect should only trigger once for the count and total:
    expect(countEl.textContent).toEqual('1');
    expect(totalEl.textContent).toEqual('1');
    done();
  });

  it('initial spawned actor should be immediately available', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });

    interface Ctx {
      actorRef?: ActorRefFrom<typeof childMachine>;
    }

    const machine = createMachine<Ctx>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          })
        }
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state] = useActor(props.actor);

      expect(state().value).toEqual('active');

      done();

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      const { actorRef } = state.context;

      return <ChildTest actor={actorRef!} />;
    };

    render(() => <Test />);
  });

  it('spawned actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent({ type: 'FINISH' }) }
          }
        }
      }
    });
    const machine = createMachine<{
      actorRef?: ActorRefFrom<typeof childMachine>;
    }>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          }),
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest = (props: { actor: ActorRefFrom<typeof childMachine> }) => {
      const [state, send] = useActor(props.actor);
      createEffect(() => {
        expect(state().value).toEqual('active');
      });

      onMount(() => {
        send({ type: 'FINISH' });
      });

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      createEffect(() => {
        if (state.matches('success')) {
          done();
        }
      });

      return <ChildTest actor={state.context.actorRef!} />;
    };

    render(() => <Test />);
  });

  it('should provide value from `actor.getSnapshot()` immediately', () => {
    const simpleActor = toActorRef({
      id: 'test',
      send: () => {
        /* ... */
      },
      getSnapshot: () => 42,
      subscribe: () => {
        return {
          unsubscribe: () => {
            /* ... */
          }
        };
      }
    });

    const Test = () => {
      const [state] = useActor(simpleActor);

      return <div data-testid="state">{state()}</div>;
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');

    expect(div.textContent).toEqual('42');
  });

  it('should update snapshot value when actor changes', () => {
    const createSimpleActor = (value: number) =>
      toActorRef({
        send: () => {
          /* ... */
        },
        getSnapshot: () => value,
        subscribe: () => {
          return {
            unsubscribe: () => {
              /* ... */
            }
          };
        }
      }) as ActorRef<any, any>;

    const Test = () => {
      const [actor, setActor] = createSignal(createSimpleActor(42));
      const [state] = useActor(actor);

      return (
        <div>
          <div data-testid="state">{state()}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(100))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const button = screen.getByTestId('button');

    expect(div.textContent).toEqual('42');
    fireEvent.click(button);
    expect(div.textContent).toEqual('100');
  });

  it('should update snapshot Date value when actor changes', () => {
    const createSimpleActor = (value: Date) =>
      toActorRef({
        send: () => {
          /* ... */
        },
        getSnapshot: () => value,
        subscribe: () => {
          return {
            unsubscribe: () => {
              /* ... */
            }
          };
        }
      }) as ActorRef<any, Date>;

    const Test = () => {
      const [actor, setActor] = createSignal(
        createSimpleActor(new Date('2020'))
      );
      const [state] = useActor(actor);

      return (
        <div>
          <div data-testid="state">{state().getFullYear() + 1}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(new Date('2022')))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const button = screen.getByTestId('button');

    expect(div.textContent).toEqual('2020');
    fireEvent.click(button);
    expect(div.textContent).toEqual('2022');
  });

  it('should rerender and trigger effects only on array changes', () => {
    const createSimpleActor = (value: string[]) =>
      toActorRef({
        send: () => {
          /* ... */
        },
        getSnapshot: () => value,
        subscribe: () => {
          return {
            unsubscribe: () => {
              /* ... */
            }
          };
        }
      }) as ActorRef<any, string[]>;

    const Test = () => {
      const [actor, setActor] = createSignal(createSimpleActor(['1', '2']));
      const [state] = useActor(actor);
      const [change, setChange] = createSignal(0);

      createEffect(() => {
        if (state()[0]) {
          setChange((val) => val + 1);
        }
      });

      return (
        <div>
          <div data-testid="change">{change()}</div>
          <div data-testid="state">{state()[1]}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(['1', '3']))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const changeVal = screen.getByTestId('change');
    const button = screen.getByTestId('button');

    expect(changeVal.textContent).toEqual('1');
    expect(div.textContent).toEqual('2');
    fireEvent.click(button);
    expect(div.textContent).toEqual('3');
    expect(changeVal.textContent).toEqual('2');
  });

  it('getSnapshot Map should match vanilla Solid behavior', () => {
    const createSimpleActor = (value: Map<string, string>) =>
      toActorRef({
        send: () => {
          /* ... */
        },
        getSnapshot: () => value,
        subscribe: () => {
          return {
            unsubscribe: () => {
              /* ... */
            }
          };
        }
      }) as ActorRef<any, Map<string, string>>;

    const Test = () => {
      const map1 = new Map([
        ['prop1', 'value'],
        ['prop2', '5']
      ]);
      const [actor, setActor] = createSignal(createSimpleActor(map1));
      const [signal, setSignal] = createSignal(map1);
      const [state] = useActor(actor);
      const [actorChange, setActorChange] = createSignal(0);
      const [signalChange, setSignalChange] = createSignal(0);

      createEffect(() => {
        if (state().get('prop1')) {
          setActorChange((val) => val + 1);
        }
      });

      createEffect(() => {
        if (signal().get('prop1')) {
          setSignalChange((val) => val + 1);
        }
      });

      return (
        <div>
          <div data-testid="actor-change">{actorChange()}</div>
          <div data-testid="signal-change">{signalChange()}</div>
          <div data-testid="actor-state">{signal().get('prop2')}</div>
          <div data-testid="signal-state">{state().get('prop2')}</div>
          <button
            data-testid="button"
            onclick={() => {
              const newMap = new Map([
                ['prop1', 'value'],
                ['prop2', '10']
              ]);
              setSignal(newMap);
              setActor(createSimpleActor(newMap));
            }}
          />
        </div>
      );
    };

    render(() => <Test />);

    const actorState = screen.getByTestId('actor-state');
    const signalState = screen.getByTestId('signal-state');
    const actorChangeVal = screen.getByTestId('actor-change');
    const signalChangeVal = screen.getByTestId('signal-change');
    const button = screen.getByTestId('button');

    expect(signalChangeVal.textContent).toEqual('1');
    expect(actorChangeVal.textContent).toEqual('1');
    expect(actorState.textContent).toEqual('5');
    expect(signalState.textContent).toEqual('5');
    fireEvent.click(button);
    expect(actorState.textContent).toEqual('10');
    expect(signalState.textContent).toEqual('10');
    expect(signalChangeVal.textContent).toEqual('2');
    expect(actorChangeVal.textContent).toEqual('2');
  });

  it('send() should be stable', (done) => {
    jest.useFakeTimers();
    const fakeSubscribe = () => {
      return {
        unsubscribe: () => {
          /* ... */
        }
      };
    };
    const noop = () => {
      /* ... */
    };
    const firstActor = toActorRef({
      send: noop,
      subscribe: fakeSubscribe
    });
    const lastActor = toActorRef({
      send: () => {
        done();
      },
      subscribe: fakeSubscribe
    });

    const Test = () => {
      const [actor, setActor] = createSignal(firstActor);
      const [, send] = useActor(actor);

      onMount(() => {
        setTimeout(() => {
          // The `send` here is closed-in
          send({ type: 'anything' });
        }, 10);
      }); // Intentionally omit `send` from dependency array

      return (
        <button data-testid="button" onclick={() => setActor(lastActor)} />
      );
    };

    render(() => <Test />);

    // At this point, `send` refers to the first (noop) actor

    const button = screen.getByTestId('button');
    fireEvent.click(button);
    done();
    // At this point, `send` refers to the last actor
    // The effect will call the closed-in `send`, which originally
    // was the reference to the first actor. Now that `send` is stable,
    // it will always refer to the latest actor.
  });

  it('should also work with services', () => {
    const counterMachine = createMachine<
      { count: number },
      { type: 'INC' } | { type: 'SOMETHING' }
    >(
      {
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              INC: { actions: assign({ count: (ctx) => ctx.count + 1 }) },
              SOMETHING: { actions: 'doSomething' }
            }
          }
        }
      },
      {
        actions: {
          doSomething: () => {
            /* do nothing */
          }
        }
      }
    );
    const counterService = interpret(counterMachine).start();

    const Counter = () => {
      const [state, send] = useActor(counterService);

      return (
        <div
          data-testid="count"
          onclick={() => {
            send({ type: 'INC' });
            // @ts-expect-error
            send({ type: 'FAKE' });
          }}
        >
          {state().context.count}
        </div>
      );
    };

    render(() => (
      <div>
        <Counter />
        <Counter />
      </div>
    ));

    const countEls = screen.getAllByTestId('count');

    expect(countEls.length).toBe(2);

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('0');
    });

    counterService.send({ type: 'INC' });

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('1');
    });
  });

  it('actor should be updated when it changes shallow', () => {
    const counterMachine = createMachine<{ count: number }>({
      id: 'counter',
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            INC: { actions: assign({ count: (ctx) => ctx.count + 1 }) },
            SOMETHING: { actions: 'doSomething' }
          }
        }
      }
    });

    const counterService1 = interpret(counterMachine).start();
    const counterService2 = interpret(counterMachine).start();

    const Counter = (props: {
      counterRef: Accessor<ActorRefFrom<typeof counterMachine>>;
    }) => {
      const [state, send] = useActor(props.counterRef);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="count">{state().context.count}</div>
        </div>
      );
    };
    const CounterParent = () => {
      const [service, setService] = createSignal(counterService1);

      return (
        <div>
          <button
            data-testid="change-service"
            onclick={() => setService(counterService2)}
          />
          <Counter counterRef={service} />
        </div>
      );
    };

    render(() => <CounterParent />);

    const changeServiceButton = screen.getByTestId('change-service');
    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    fireEvent.click(changeServiceButton);
    expect(countEl.textContent).toBe('0');
  });

  it('actor should be updated when it changes deep', () => {
    const counterMachine2 = createMachine<{
      subCount: { subCount1: { subCount2: { count: number } } };
    }>({
      id: 'counter',
      initial: 'active',
      context: { subCount: { subCount1: { subCount2: { count: 0 } } } },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({
                subCount: (ctx) => ({
                  ...ctx.subCount,
                  subCount1: {
                    ...ctx.subCount.subCount1,
                    subCount2: {
                      ...ctx.subCount.subCount1.subCount2,
                      count: ctx.subCount.subCount1.subCount2.count + 1
                    }
                  }
                })
              })
            },
            SOMETHING: { actions: 'doSomething' }
          }
        }
      }
    });
    const counterService1 = interpret(counterMachine2).start();
    const counterService2 = interpret(counterMachine2).start();

    const Counter = (props: {
      counterRef: Accessor<ActorRefFrom<typeof counterMachine2>>;
    }) => {
      const [state, send] = useActor(props.counterRef);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="count">
            {state().context.subCount.subCount1.subCount2.count}
          </div>
        </div>
      );
    };
    const CounterParent = () => {
      const [service, setService] = createSignal(counterService1);

      return (
        <div>
          <button
            data-testid="change-service"
            onclick={() => setService(counterService2)}
          />
          <Counter counterRef={service} />
        </div>
      );
    };

    render(() => <CounterParent />);

    const changeServiceButton = screen.getByTestId('change-service');
    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    fireEvent.click(changeServiceButton);
    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
  });

  it('actor should only trigger effect of directly tracked value', () => {
    const counterMachine2 = createMachine<{
      subCount: { subCount1: { subCount2: { count: number } } };
    }>({
      id: 'counter',
      initial: 'active',
      context: { subCount: { subCount1: { subCount2: { count: 0 } } } },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({
                subCount: (ctx) => ({
                  ...ctx.subCount,
                  subCount1: {
                    ...ctx.subCount.subCount1,
                    subCount2: {
                      ...ctx.subCount.subCount1.subCount2,
                      count: ctx.subCount.subCount1.subCount2.count + 1
                    }
                  }
                })
              })
            },
            SOMETHING: { actions: 'doSomething' }
          }
        }
      }
    });

    const Counter = () => {
      const counterService = interpret(counterMachine2).start();
      const [state, send] = useActor(counterService);
      const [effectCount, setEffectCount] = createSignal(0);
      createEffect(
        on(
          () => state().context.subCount.subCount1,
          () => {
            setEffectCount((prev) => prev + 1);
          },
          {
            defer: true
          }
        )
      );
      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="effect-count">{effectCount()}</div>
          <div data-testid="count">
            {state().context.subCount.subCount1.subCount2.count}
          </div>
        </div>
      );
    };

    render(() => <Counter />);

    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');
    const effectCountEl = screen.getByTestId('effect-count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    expect(effectCountEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('2');
    expect(effectCountEl.textContent).toBe('0');
  });

  it('referenced object in context should not update both services', (done) => {
    const latestValue = { value: 100 };
    interface Context {
      latestValue: { value: number };
    }
    const machine = createMachine<Context, { type: 'INC' }>({
      initial: 'initial',
      context: {
        latestValue
      },
      states: {
        initial: {
          on: {
            INC: {
              actions: [
                assign({
                  latestValue: (ctx: Context) => ({
                    value: ctx.latestValue.value + 1
                  })
                })
              ]
            }
          }
        }
      }
    });

    const Test = () => {
      const service1 = interpret(machine).start();
      const service2 = interpret(machine).start();
      const [state1, send1] = useActor(service1);
      const [state2, send2] = useActor(service2);

      return (
        <div>
          <div>
            <button
              data-testid="inc-machine1"
              onclick={() => send1({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine1">
              {state1().context.latestValue.value}
            </div>
          </div>
          <div>
            <button
              data-testid="inc-machine2"
              onclick={() => send2({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine2">
              {state2().context.latestValue.value}
            </div>
          </div>
        </div>
      );
    };

    render(() => <Test />);

    const machine1Value = screen.getByTestId('value-machine1');
    const machine2Value = screen.getByTestId('value-machine2');
    const incMachine1 = screen.getByTestId('inc-machine1');
    const incMachine2 = screen.getByTestId('inc-machine2');

    expect(machine1Value.textContent).toEqual('100');
    expect(machine2Value.textContent).toEqual('100');

    fireEvent.click(incMachine1);

    expect(machine1Value.textContent).toEqual('101');
    expect(machine2Value.textContent).toEqual('100');

    fireEvent.click(incMachine2);

    expect(machine1Value.textContent).toEqual('101');
    expect(machine2Value.textContent).toEqual('101');
    done();
  });

  it('should work with initially deferred actors spawned in lazy context', () => {
    const childMachine = createMachine({
      initial: 'one',
      states: {
        one: {
          on: { NEXT: 'two' }
        },
        two: {}
      }
    });

    const machine = createMachine<{ ref: ActorRef<any> }>({
      context: () => ({
        ref: spawn(childMachine)
      }),
      initial: 'waiting',
      states: {
        waiting: {
          on: { TEST: 'success' }
        },
        success: {
          type: 'final'
        }
      }
    });

    const App = () => {
      const [state] = useMachine(machine);
      const [childState, childSend] = useActor(state.context.ref);

      return (
        <div>
          <div data-testid="child-state">{childState().value}</div>
          <button
            data-testid="child-send"
            onclick={() => childSend({ type: 'NEXT' })}
          />
        </div>
      );
    };

    render(() => <App />);

    const elState = screen.getByTestId('child-state');
    const elSend = screen.getByTestId('child-send');
    expect(elState.textContent).toEqual('one');
    fireEvent.click(elSend);

    expect(elState.textContent).toEqual('two');
  });
});
