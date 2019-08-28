import bindAll from 'lodash.bindall';
import debounce from 'lodash.debounce';
import defaultsDeep from 'lodash.defaultsdeep';
import makeToolboxXML from '../lib/make-toolbox-xml';
import PropTypes from 'prop-types';
import React from 'react';
import VMScratchBlocks from '../lib/blocks';
import VM from 'scratch-vm';

import log from '../lib/log.js';
import Prompt from './prompt.jsx';
import BlocksComponent from '../components/blocks/blocks.jsx';
import ExtensionLibrary from './extension-library.jsx';
import extensionData from '../lib/libraries/extensions/index.jsx';
import CustomProcedures from './custom-procedures.jsx';
import errorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {STAGE_DISPLAY_SIZES} from '../lib/layout-constants';
import DropAreaHOC from '../lib/drop-area-hoc.jsx';
import DragConstants from '../lib/drag-constants';
import defineDynamicBlock from '../lib/define-dynamic-block';

//TYLER MACHINE LEARNING STUFF
import * as tf from '@tensorflow/tfjs';

import {connect} from 'react-redux';
import {updateToolbox} from '../reducers/toolbox';
import {activateColorPicker} from '../reducers/color-picker';
import {closeExtensionLibrary, openSoundRecorder, openConnectionModal} from '../reducers/modals';
import {activateCustomProcedures, deactivateCustomProcedures} from '../reducers/custom-procedures';
import {setConnectionModalExtensionId} from '../reducers/connection-modal';

import {
    activateTab,
    SOUNDS_TAB_INDEX
} from '../reducers/editor-tab';

const addFunctionListener = (object, property, callback) => {
    const oldFn = object[property];
    object[property] = function () {
        const result = oldFn.apply(this, arguments);
        callback.apply(this, result);
        return result;
    };
};

const DroppableBlocks = DropAreaHOC([
    DragConstants.BACKPACK_CODE
])(BlocksComponent);

// Scratch block index dictionary for ML model.
const BLOCK_2_IDX = {'': 0,
 'control_forever': 1,
 'looks_switchcostumeto': 2,
 'control_wait_until': 3,
 '-': 4,
 'motion_gotoxy': 5,
 'motion_setrotationstyle': 6,
 'data_deleteoflist': 7,
 'motion_changexby': 8,
 'sound_play': 9,
 'data_lengthoflist': 10,
 'motion_turnleft': 11,
 'sound_changevolumeby': 12,
 'looks_nextbackdrop': 13,
 'motion_ifonedgebounce': 14,
 'looks_nextcostume': 15,
 'data_hidelist': 16,
 'data_itemnumoflist': 17,
 'control_repeat_until': 18,
 'sensing_coloristouchingcolor': 19,
 'motion_sety': 20,
 'sensing_answer': 21,
 'data_addtolist': 22,
 'sound_seteffectto': 23,
 'event_broadcast': 24,
 'sensing_username': 25,
 'looks_say': 26,
 'control_create_clone_of': 27,
 'motion_setx': 28,
 'looks_think': 29,
 'event_whenbroadcastreceived': 30,
 'looks_show': 31,
 'control_delete_this_clone': 32,
 'data_replaceitemoflist': 33,
 'event_whenthisspriteclicked': 34,
 'data_setvariableto': 35,
 'sensing_touchingcolor': 36,
 'event_broadcastandwait': 37,
 'looks_costumenumbername': 38,
 'motion_changeyby': 39,
 'motion_pointindirection': 40,
 'data_itemoflist': 41,
 'data_deletealloflist': 42,
 'motion_movesteps': 43,
 'data_hidevariable': 44,
 'looks_switchbackdroptoandwait': 45,
 'data_changevariableby': 46,
 'sensing_dayssince2000': 47,
 'control_start_as_clone': 48,
 'event_whenflagclicked': 49,
 'sensing_touchingobject': 50,
 'control_if_else': 51,
 'data_listcontainsitem': 52,
 'looks_sayforsecs': 53,
 'data_showlist': 54,
 'looks_backdropnumbername': 55,
 'control_wait': 56,
 'motion_glidesecstoxy': 57,
 'looks_seteffectto': 58,
 'sensing_mousex': 59,
 'sensing_of': 60,
 'sensing_timer': 61,
 'sound_cleareffects': 62,
 'sensing_loudness': 63,
 'sensing_distanceto': 64,
 'motion_yposition': 65,
 'looks_setsizeto': 66,
 'sound_playuntildone': 67,
 'looks_thinkforsecs': 68,
 'data_insertatlist': 69,
 'sensing_current': 70,
 'motion_pointtowards': 71,
 'control_repeat': 72,
 'event_whenbackdropswitchesto': 73,
 '>': 74,
 'looks_hide': 75,
 'event_whengreaterthan': 76,
 'sensing_setdragmode': 77,
 'looks_gotofrontback': 78,
 'looks_changeeffectby': 79,
 'control_if': 80,
 'motion_goto': 81,
 'sound_setvolumeto': 82,
 'sound_changeeffectby': 83,
 'event_whenkeypressed': 84,
 'motion_direction': 85,
 'sensing_keypressed': 86,
 'looks_size': 87,
 'motion_turnright': 88,
 'looks_goforwardbackwardlayers': 89,
 'motion_glideto': 90,
 'control_stop': 91,
 'motion_xposition': 92,
 'sensing_askandwait': 93,
 'sound_stopallsounds': 94,
 'looks_cleargraphiceffects': 95,
 'sensing_mousey': 96,
 'looks_switchbackdropto': 97,
 'data_showvariable': 98,
 'sensing_resettimer': 99,
 'sensing_mousedown': 100,
 'looks_changesizeby': 101
};

// Populate this in the constructor
let IDX_2_BLOCK = {}

const modelURL = 'https://ty-has-a-bucket.s3.amazonaws.com/trained-models/tfjs/model.json'

class Blocks extends React.Component {
    constructor (props) {
        super(props);
        this.ScratchBlocks = VMScratchBlocks(props.vm);
        bindAll(this, [
            'attachVM',
            'detachVM',
            'getToolboxXML',
            'handleCategorySelected',
            'handleConnectionModalStart',
            'handleDrop',
            'handleStatusButtonUpdate',
            'handleOpenSoundRecorder',
            'handlePromptStart',
            'handlePromptCallback',
            'handlePromptClose',
            'handleCustomProceduresClose',
            'onScriptGlowOn',
            'onScriptGlowOff',
            'onBlockGlowOn',
            'onBlockGlowOff',
            'handleExtensionAdded',
            'handleBlocksInfoUpdate',
            'onTargetsUpdate',
            'onVisualReport',
            'onWorkspaceUpdate',
            'onWorkspaceMetricsChange',
            'setBlocks',
            'setLocale',
            'workspaceChanged',
            'onProjectLoaded',
            'encodeSequence',
            'decodeSequence',
            'topIndices'
        ]);
        this.ScratchBlocks.prompt = this.handlePromptStart;
        this.ScratchBlocks.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.state = {
            workspaceMetrics: {},
            prompt: null
        };
        this.onTargetsUpdate = debounce(this.onTargetsUpdate, 100);
        this.toolboxUpdateQueue = [];

        // Populate the index => block dictionary
        for (var key in BLOCK_2_IDX) {
            if (BLOCK_2_IDX.hasOwnProperty(key)) {
                IDX_2_BLOCK[BLOCK_2_IDX[key]] = key;
            }
        }
    }

    // Add async to load ML model.
    // async
    componentDidMount() {
      // try {
        this.ScratchBlocks.FieldColourSlider.activateEyedropper_ = this.props.onActivateColorPicker;
        this.ScratchBlocks.Procedures.externalProcedureDefCallback = this.props.onActivateCustomProcedures;
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);

        const workspaceConfig = defaultsDeep({},
            Blocks.defaultOptions,
            this.props.options,
            {rtl: this.props.isRtl, toolbox: this.props.toolboxXML}
        );

        // CREATING THE WORKSPACE.
        this.workspace = this.ScratchBlocks.inject(this.blocks, workspaceConfig);

        // Register buttons under new callback keys for creating variables,
        // lists, and procedures from extensions.

        const toolboxWorkspace = this.workspace.getFlyout().getWorkspace();

        const varListButtonCallback = type =>
            (() => this.ScratchBlocks.Variables.createVariable(this.workspace, null, type));
        const procButtonCallback = () => {
            this.ScratchBlocks.Procedures.createProcedureDefCallback_(this.workspace);
        };

        toolboxWorkspace.registerButtonCallback('MAKE_A_VARIABLE', varListButtonCallback(''));
        toolboxWorkspace.registerButtonCallback('MAKE_A_LIST', varListButtonCallback('list'));
        toolboxWorkspace.registerButtonCallback('MAKE_A_PROCEDURE', procButtonCallback);

        // Store the xml of the toolbox that is actually rendered.
        // This is used in componentDidUpdate instead of prevProps, because
        // the xml can change while e.g. on the costumes tab.
        this._renderedToolboxXML = this.props.toolboxXML;

        // we actually never want the workspace to enable "refresh toolbox" - this basically re-renders the
        // entire toolbox every time we reset the workspace.  We call updateToolbox as a part of
        // componentDidUpdate so the toolbox will still correctly be updated
        this.setToolboxRefreshEnabled = this.workspace.setToolboxRefreshEnabled.bind(this.workspace);
        this.workspace.setToolboxRefreshEnabled = () => {
            this.setToolboxRefreshEnabled(false);
        };

        // @todo change this when blockly supports UI events
        addFunctionListener(this.workspace, 'translate', this.onWorkspaceMetricsChange);
        addFunctionListener(this.workspace, 'zoom', this.onWorkspaceMetricsChange);

        this.attachVM();
        // Only update blocks/vm locale when visible to avoid sizing issues
        // If locale changes while not visible it will get handled in didUpdate
        if (this.props.isVisible) {
            this.setLocale();
        }

        // Only after the VM Completely mounts do you call tensorflow
        const loadModel = tf.loadLayersModel(modelURL);

        // Hacky wait to make sure VM is compltely loaded
        window.setTimeout(function(){
          window.vm = this.props.vm
          this.vm = this.props.vm
          loadModel.then(model => { this.model = model; window.model = model });
        }.bind(this),1000);

    }

    shouldComponentUpdate (nextProps, nextState) {
        return (
            this.state.prompt !== nextState.prompt ||
            this.props.isVisible !== nextProps.isVisible ||
            this._renderedToolboxXML !== nextProps.toolboxXML ||
            this.props.extensionLibraryVisible !== nextProps.extensionLibraryVisible ||
            this.props.customProceduresVisible !== nextProps.customProceduresVisible ||
            this.props.locale !== nextProps.locale ||
            this.props.anyModalVisible !== nextProps.anyModalVisible ||
            this.props.stageSize !== nextProps.stageSize
        );
    }
    componentDidUpdate (prevProps) {
        // If any modals are open, call hideChaff to close z-indexed field editors
        if (this.props.anyModalVisible && !prevProps.anyModalVisible) {
            this.ScratchBlocks.hideChaff();
        }

        // Only rerender the toolbox when the blocks are visible and the xml is
        // different from the previously rendered toolbox xml.
        // Do not check against prevProps.toolboxXML because that may not have been rendered.
        if (this.props.isVisible && this.props.toolboxXML !== this._renderedToolboxXML) {
            this.requestToolboxUpdate();
        }

        if (this.props.isVisible === prevProps.isVisible) {
            if (this.props.stageSize !== prevProps.stageSize) {
                // force workspace to redraw for the new stage size
                window.dispatchEvent(new Event('resize'));
            }
            return;
        }
        // @todo hack to resize blockly manually in case resize happened while hidden
        // @todo hack to reload the workspace due to gui bug #413
        if (this.props.isVisible) { // Scripts tab
            this.workspace.setVisible(true);
            if (prevProps.locale !== this.props.locale || this.props.locale !== this.props.vm.getLocale()) {
                // call setLocale if the locale has changed, or changed while the blocks were hidden.
                // vm.getLocale() will be out of sync if locale was changed while not visible
                this.setLocale();
            } else {
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
            }

            window.dispatchEvent(new Event('resize'));
        } else {
            this.workspace.setVisible(false);
        }
    }
    componentWillUnmount () {
        this.detachVM();
        this.workspace.dispose();
        clearTimeout(this.toolboxUpdateTimeout);
    }
    requestToolboxUpdate () {
        clearTimeout(this.toolboxUpdateTimeout);
        this.toolboxUpdateTimeout = setTimeout(() => {
            this.updateToolbox();
        }, 0);
    }
    setLocale () {
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);
        this.props.vm.setLocale(this.props.locale, this.props.messages)
            .then(() => {
                this.workspace.getFlyout().setRecyclingEnabled(false);
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
                this.withToolboxUpdates(() => {
                    this.workspace.getFlyout().setRecyclingEnabled(true);
                });
            });
    }

    updateToolbox () {
        this.toolboxUpdateTimeout = false;

        const categoryId = this.workspace.toolbox_.getSelectedCategoryId();
        const offset = this.workspace.toolbox_.getCategoryScrollOffset();
        this.workspace.updateToolbox(this.props.toolboxXML);
        this._renderedToolboxXML = this.props.toolboxXML;

        // In order to catch any changes that mutate the toolbox during "normal runtime"
        // (variable changes/etc), re-enable toolbox refresh.
        // Using the setter function will rerender the entire toolbox which we just rendered.
        this.workspace.toolboxRefreshEnabled_ = true;

        const currentCategoryPos = this.workspace.toolbox_.getCategoryPositionById(categoryId);
        const currentCategoryLen = this.workspace.toolbox_.getCategoryLengthById(categoryId);
        if (offset < currentCategoryLen) {
            this.workspace.toolbox_.setFlyoutScrollPos(currentCategoryPos + offset);
        } else {
            this.workspace.toolbox_.setFlyoutScrollPos(currentCategoryPos);
        }

        const queue = this.toolboxUpdateQueue;
        this.toolboxUpdateQueue = [];
        queue.forEach(fn => fn());
    }

    withToolboxUpdates (fn) {
        // if there is a queued toolbox update, we need to wait
        if (this.toolboxUpdateTimeout) {
            this.toolboxUpdateQueue.push(fn);
        } else {
            fn();
        }
    }

    attachVM () {
        this.workspace.addChangeListener(this.props.vm.blockListener);
        this.workspace.addChangeListener(this.workspaceChanged)

        this.flyoutWorkspace = this.workspace
            .getFlyout()
            .getWorkspace();
        this.flyoutWorkspace.addChangeListener(this.props.vm.flyoutBlockListener);
        this.flyoutWorkspace.addChangeListener(this.props.vm.monitorBlockListener);

        // Testing new listeners
        this.props.vm.addListener('PROJECT_LOADED', this.onProjectLoaded);
        this.props.vm.addListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.addListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.addListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.addListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.addListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.addListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.addListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.addListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.addListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.addListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.addListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
    }
    detachVM () {
        this.props.vm.removeListener('PROJECT_LOADED', this.onProjectLoaded);
        this.props.vm.removeListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.removeListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.removeListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.removeListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.removeListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.removeListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.removeListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.removeListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.removeListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.removeListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.removeListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
    }

    // TEST
    workspaceChanged(e) {

      let path;
      let _next = "-"
      let _nest = ">"

      // console.log(e)

      // Need to feed in an array of integers into the model.
      // 1. Calculate the path from the current block up the tree, parent by parent, until parent isn't null.
      // 1. pad the selected terminal path (prepending)
      // 2.
      // // feed currentBlocks to model
      // // create new blocks
      // // obtain the vm representation for the new blocks (from model)
      // newBlocks.forEach(blockRep => this.vm.runtime.getEditingTarget().blocks.createBlock(blockRep));
      // // this.vm.runtime.getEditngTarget().blocks.toXML();
      // this.vm.emitWorkspaceUpdate();
      const allBlocks = this.props.vm.runtime._editingTarget.blocks._blocks;
      var currBlock = allBlocks[e.blockId];
      switch (e.type){
      case 'create':
            if(this.workspace.blockDB_[e.blockId].type === 'surprise_surprisenow') {

                let currBlockData = this.workspace.blockDB_[e.blockId];
                currBlockData.dispose()

                var availableCategories = ['motion', 'looks', 'sound', 'event', 'control']
                var domBlocks = this.ScratchBlocks.Xml.textToDom(this.getToolboxXML()).getElementsByTagName('block');
                var toolboxBlocks = Array.from(domBlocks).filter(b=>availableCategories.includes(b.getAttribute('type').split('_')[0]));
                // Specially excluded blocks from the chosen categories
                var excludedBlocks = ['motion_ifonedgebounce', 'motion_setrotationstyle', 'motion_xposition',  'motion_yposition',  'motion_direction',
                                      'looks_show', 'looks_hide', 'looks_cleargraphiceffects', 'looks_gotofrontback', 'looks_goforwardbackwardlayers', 'looks_costumenumbername', 'looks_backdropnumbername', 'looks_size',
                                      'sound_stopallsounds', 'sound_cleareffects', 'sound_volume',
                                      'event_whenbackdropswitchesto', 'event_whengreaterthan', 'event_whenbroadcastreceived', 'event_broadcast', 'event_broadcastandwait',
                                      'control_if', 'control_if_else', 'control_wait_until', 'control_repeat_until', 'control_stop', 'control_start_as_clone', 'control_create_clone_of', 'control_delete_this_clone']
                toolboxBlocks = toolboxBlocks.filter(b=>!excludedBlocks.includes(b.getAttribute('type')))
                var blockXML = toolboxBlocks[Math.floor(Math.random() * toolboxBlocks.length)];
                var newBlock = this.ScratchBlocks.Xml.domToBlock(blockXML, this.workspace);

                console.log(newBlock)

                this.ScratchBlocks.Events.disable();
                try {
                  // Scratch-specific: Give shadow dom new IDs to prevent duplicating on paste
                  this.ScratchBlocks.scratchBlocksUtils.changeObscuredShadowIds(newBlock);

                  var svgRootNew = newBlock.getSvgRoot();
                  if (!svgRootNew) {
                    throw new Error('newBlock is not rendered.');
                  }
                  // Place the new block as the same position as the old block.
                  // TODO: Offset by the difference between the mouse position and the upper
                  // left corner of the block.
                  // var point = Blockly.utils.mouseToSvg(this.lastEvent_, this.workspace_.getParentSvg(),  this.workspace_.getInverseScreenCTM());
                  var rel = this.workspace.getOriginOffsetInPixels();
                  let newX = (this.workspace.mouseX-rel.x) / this.workspace.scale;
                  let newY = (this.workspace.mouseY-rel.y) / this.workspace.scale;
                  // newBlock.moveBy(newX, newY - newBlock.height * 2);
                  newBlock.moveBy(0, this.workspace.lastEvent.clientY);
                  // Perhaps suggest related blocks that are linked to others

                } finally {
                  this.ScratchBlocks.Events.enable();
                }
                if (this.ScratchBlocks.Events.isEnabled()) {
                  this.ScratchBlocks.Events.fire(new this.ScratchBlocks.Events.BlockCreate(newBlock));
                }
                console.log(this.workspace.mouseX, this.workspace.mouseY)
                var fakeEvent = {
                  clientX: rel.x,
                  clientY: this.workspace.lastEvent.clientY + newBlock.height,
                  type: 'mousedown',
                  preventDefault: function() {
                    this.workspace.lastEvent.preventDefault();
                  },
                  stopPropagation: function() {
                    this.workspace.lastEvent.stopPropagation();
                  },
                  target: this.workspace.lastEvent.target
                };
                this.workspace.startDragWithFakeEvent(fakeEvent, newBlock);
              }
          /*
          create a fake drag event?
          copy the block to the
          the moment you drag it out, you want to dispose then create a new block with a fake drag event at the mouse position
          */
          break;
      case 'endDrag':

            if(currBlock['opcode'] === 'surprise_surprise') {
              let currBlockData = this.workspace.blockDB_[e.blockId];
              if(currBlockData === undefined) {
                break;
              }

              let oldPos = currBlockData.getRelativeToSurfaceXY();

              var availableCategories = ['motion', 'looks', 'sound', 'event', 'control']
              var domBlocks = this.ScratchBlocks.Xml.textToDom(this.getToolboxXML()).getElementsByTagName('block');
              var toolboxBlocks = Array.from(domBlocks).filter(b=>availableCategories.includes(b.getAttribute('type').split('_')[0]));

              // Specially excluded blocks from the chosen categories
              var excludedBlocks = ['motion_ifonedgebounce', 'motion_setrotationstyle', 'motion_xposition',  'motion_yposition',  'motion_direction',
                                    'looks_show', 'looks_hide', 'looks_cleargraphiceffects', 'looks_gotofrontback', 'looks_goforwardbackwardlayers', 'looks_costumenumbername', 'looks_backdropnumbername', 'looks_size',
                                    'sound_stopallsounds', 'sound_cleareffects', 'sound_volume',
                                    'event_whenbackdropswitchesto', 'event_whengreaterthan', 'event_whenbroadcastreceived', 'event_broadcast', 'event_broadcastandwait',
                                    'control_if', 'control_if_else', 'control_wait_until', 'control_repeat_until', 'control_stop', 'control_start_as_clone', 'control_create_clone_of', 'control_delete_this_clone']


              var hats = ['event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked']

              // at the top
              if(currBlockData.parentBlock_ !== null) {
                excludedBlocks = excludedBlocks.concat(hats)
                console.log("not top level.")
              }

              // Perhaps choose from relevant subsets
              // If the block is on top, choose random from events
              // Otherwise excluse hats
              // blocks = blocks.filter(b=>!excludedBlocks.includes(b.id))
              toolboxBlocks = toolboxBlocks.filter(b=>!excludedBlocks.includes(b.getAttribute('type')))
              console.log(Array.from(toolboxBlocks).map(b=>b.getAttribute('type')))

              // toolboxBlocks = toolboxBlocks.filter(b=>b.getAttribute('type') === 'control_forever')

              var blockXML = toolboxBlocks[Math.floor(Math.random() * toolboxBlocks.length)];
              var newBlock = this.ScratchBlocks.Xml.domToBlock(blockXML, this.workspace);

              // you want to init the svg, move it, and connect it to the current blocks connections
              // debugger;
              newBlock.initSvg();
              newBlock.moveBy(oldPos.x, oldPos.y);

              //
              // add to the excluded blocks based on the position you dropped into?
              // used to handle hat blocks and stuff

              // Hat blocks will be null here
              if(newBlock.previousConnection !== null) {
                newBlock.previousConnection.connect(currBlockData.previousConnection.targetConnection);
              }

              // // Forever / stop blocks will be null here.
              // Maybe while it's dragging, you can change the color of it?
              if(newBlock.nextConnection !== null) {
                newBlock.nextConnection.connect(currBlockData.previousConnection);
              } else {
                console.log("No next")
                newBlock.getFirstStatementConnection().connect(currBlockData.nextConnection.targetConnection)
              }
              //
              // if(newBlock.getAttribute('type').includes('event')) {
              //   newBlock.moveBy()
              // }
              newBlock.fromSurprise = true
              newBlock.snapToGrid();
              // passing in true "heals" the stack
              currBlockData.dispose(true);
            }

            else if (currBlock['opcode'] === 'surprise_suggestion') {
              path = [currBlock.opcode]
                // keep track of the next parent in the tree
              let parent;

              // never enters if there's only one block in the sequence
              while(!currBlock.topLevel) {
                currBlock = allBlocks[currBlock.parent]

                // FIXME: Doesn't work...
                // Skip over blocks in the sequence that are not included in the base blocks.
                if (BLOCK_2_IDX[currBlock.opcode] === undefined) {
                  continue;
                }

                currBlock.next !== null ? path.unshift(_next) : path.unshift(_nest)
                path.unshift(currBlock.opcode)
              }

              let seqLength = this.model.layers[0].batchInputShape[1];
              let sequence = new Array(seqLength);
              sequence.fill('');

              if (path.length !== undefined) {
                let pathLen = path.length;
                let seqLen = sequence.length;
                // Fills up the last part of the sequence with the elements of the path.
                for(let si = seqLen-1, pi = pathLen-1; si > seqLen-1-pathLen; si--, pi--) {
                  sequence[si] = path[pi];
                }
              }

              // FIXME: handle edge case when path is longer than the input sequnece for the model.
              // Now the sequence is ready for encodng into the ML model.
              console.log(path)

              // Encode it for the model by turning it into a tensor with integer values
              // Normalize it by dividing by the vocab length
              let vocabLength = Object.keys(BLOCK_2_IDX).length
              let encoded = this.encodeSequence(sequence).map( e => e / vocabLength)
              let input = tf.tensor(encoded, [1, seqLength, 1])

              // Feed it into the model!
              let prediction = this.model.predict(input)
              // console.log(prediction.argMax())
              // let topBlock = IDX_2_BLOCK[prediction.argMax().squeeze().dataSync()]

              let topPredictions = this.topIndices(prediction.squeeze().dataSync(), 1)
              let topBlock = IDX_2_BLOCK[prediction.argMax().squeeze().dataSync()]
              console.log(topBlock)
            }

            else if (currBlock['opcode'] === 'surprise_surprisecategory') {
              console.log("Surprising from cateogry")
              let chosenCategory = currBlock.fields.category.value
              var availableCategories = ['motion', 'looks', 'sound', 'event', 'control']
              switch(chosenCategory){
                case 'all categories':
                break;
                case 'motion': availableCategories = ['motion']
                break;
                case 'looks': availableCategories = ['looks']
                break;
                case 'sounds': availableCategories = ['sound']
                break;
                case 'events': availableCategories = ['event']
                break;
                case 'control': availableCategories = ['control']
                break;
              }

              let currBlockData = this.workspace.blockDB_[e.blockId];
              if(currBlockData === undefined) {
                break;
              }

              let oldPos = currBlockData.getRelativeToSurfaceXY();

              var domBlocks = this.ScratchBlocks.Xml.textToDom(this.getToolboxXML()).getElementsByTagName('block');
              var toolboxBlocks = Array.from(domBlocks).filter(b=>availableCategories.includes(b.getAttribute('type').split('_')[0]));

              // Specially excluded blocks from the chosen categories
              var excludedBlocks = ['motion_ifonedgebounce', 'motion_setrotationstyle', 'motion_xposition',  'motion_yposition',  'motion_direction',
                                    'looks_show', 'looks_hide', 'looks_cleargraphiceffects', 'looks_gotofrontback', 'looks_goforwardbackwardlayers', 'looks_costumenumbername', 'looks_backdropnumbername', 'looks_size',
                                    'sound_stopallsounds', 'sound_cleareffects', 'sound_volume',
                                    'event_whenbackdropswitchesto', 'event_whengreaterthan', 'event_whenbroadcastreceived', 'event_broadcast', 'event_broadcastandwait',
                                    'control_if', 'control_if_else', 'control_wait_until', 'control_repeat_until', 'control_stop', 'control_start_as_clone', 'control_create_clone_of', 'control_delete_this_clone']


              var hats = ['event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked']

              // at the top
              // if(currBlockData.parentBlock_ !== null) {
              //   excludedBlocks = excludedBlocks.concat(hats)
              //   console.log("not top level.")
              // }

              // Perhaps choose from relevant subsets
              // If the block is on top, choose random from events
              // Otherwise excluse hats
              // blocks = blocks.filter(b=>!excludedBlocks.includes(b.id))
              toolboxBlocks = toolboxBlocks.filter(b=>!excludedBlocks.includes(b.getAttribute('type')))
              console.log(Array.from(toolboxBlocks).map(b=>b.getAttribute('type')))

              // toolboxBlocks = toolboxBlocks.filter(b=>b.getAttribute('type') === 'control_forever')

              var blockXML = toolboxBlocks[Math.floor(Math.random() * toolboxBlocks.length)];
              var newBlock = this.ScratchBlocks.Xml.domToBlock(blockXML, this.workspace);

              // you want to init the svg, move it, and connect it to the current blocks connections
              // debugger;
              newBlock.initSvg();
              newBlock.moveBy(oldPos.x, oldPos.y);

              //
              // add to the excluded blocks based on the position you dropped into?
              // used to handle hat blocks and stuff

              // Hat blocks will be null here
              if(newBlock.previousConnection !== null) {
                newBlock.previousConnection.connect(currBlockData.previousConnection.targetConnection);
              }

              // // Forever / stop blocks will be null here.
              // Maybe while it's dragging, you can change the color of it?
              if(newBlock.nextConnection !== null) {
                newBlock.nextConnection.connect(currBlockData.previousConnection);
              } else {
                console.log("No next")
                newBlock.getFirstStatementConnection().connect(currBlockData.nextConnection.targetConnection)
              }

              newBlock.fromSurprise = true
              //
              // if(newBlock.getAttribute('type').includes('event')) {
              //   newBlock.moveBy()
              // }

              newBlock.snapToGrid();
              // passing in true "heals" the stack
              currBlockData.dispose(true);
            }

            break;
      case 'show_block_context_menu':
            break;
      case 'block_suggest':
            // Add the current block to the path to begin.
            path = [currBlock.opcode]
              // keep track of the next parent in the tree
            let parent;

            // never enters if there's only one block in the sequence
            while(!currBlock.topLevel) {
              currBlock = allBlocks[currBlock.parent]

              // FIXME: Doesn't work...
              // Skip over blocks in the sequence that are not included in the base blocks.
              if (BLOCK_2_IDX[currBlock.opcode] === undefined) {
                continue;
              }

              currBlock.next !== null ? path.unshift(_next) : path.unshift(_nest)
              path.unshift(currBlock.opcode)
            }

            let seqLength = this.model.layers[0].batchInputShape[1];
            let sequence = new Array(seqLength);
            sequence.fill('');

            if (path.length !== undefined) {
              let pathLen = path.length;
              let seqLen = sequence.length;
              // Fills up the last part of the sequence with the elements of the path.
              for(let si = seqLen-1, pi = pathLen-1; si > seqLen-1-pathLen; si--, pi--) {
                sequence[si] = path[pi];
              }
            }

            // FIXME: handle edge case when path is longer than the input sequnece for the model.
            // Now the sequence is ready for encodng into the ML model.
            console.log(path)

            // Encode it for the model by turning it into a tensor with integer values
            // Normalize it by dividing by the vocab length
            let vocabLength = Object.keys(BLOCK_2_IDX).length
            let encoded = this.encodeSequence(sequence).map( e => e / vocabLength)
            let input = tf.tensor(encoded, [1, seqLength, 1])

            // Feed it into the model!
            let prediction = this.model.predict(input)
            let topPredictions = this.topIndices(prediction.squeeze().dataSync(), 5)
            let topBlock = IDX_2_BLOCK[prediction.argMax().squeeze().dataSync()]
            let topBlocks = topPredictions.map(p=>IDX_2_BLOCK[p])

            console.log("Top output:");
            console.log(topBlocks);

            // Take the predictions and create the actual blocks out of them
            let blocks = Array.from(Blockly.Xml.textToDom(this.getToolboxXML()).getElementsByTagName('block'));
            let predictedBlocksXml = blocks.filter(b=>topBlocks.includes(b.getAttribute('type')));
            predictedBlocksXml.forEach( x => {
              let b = this.ScratchBlocks.Xml.domToBlock(x, this.workspace);
              b.initSvg();
              b.moveBy(
                this.workspace.mouseX + Math.random() * this.ScratchBlocks.SNAP_RADIUS*5,
                this.workspace.mouseY + Math.random() * this.ScratchBlocks.SNAP_RADIUS*5
              );
            });

            // Maybe make it so that it just takes the top prediction and connects that block to the one that was just clicked to?

            break;
      }
    }

    topIndices(list, n) {
      // Returns the indices of the top n elements in a list.
      // Create a dictionary based on the indices and values.
      // sort the list
      // take the top n values from that list
      // return an array of the original indices
      let orignialIndices = {}
      for(let i = 0; i < list.length; i++) {
        orignialIndices[list[i]] = i
      }
      let sorted = list.sort();
      let sortedIndices = []
      for(let s in sorted) {
        sortedIndices.push(orignialIndices[sorted[s]])
      }
      return sortedIndices.slice(sortedIndices.length-n,sortedIndices.length);
    }

    encodeSequence(seq) {
      return seq.map(token => BLOCK_2_IDX[token])
    }

    decodeSequence(seq) {
      return seq.map(token => IDX_2_BLOCK[token])
    }

    onProjectLoaded() {
      console.log('Finsihed loading project.')
    }

    updateToolboxBlockValue (id, value) {
        this.withToolboxUpdates(() => {
            const block = this.workspace
                .getFlyout()
                .getWorkspace()
                .getBlockById(id);
            if (block) {
                block.inputList[0].fieldRow[0].setValue(value);
            }
        });
    }

    onTargetsUpdate () {
      if(this.model) {
        "Target updating."
      }

      if (this.props.vm.editingTarget && this.workspace.getFlyout()) {
          ['glide', 'move', 'set'].forEach(prefix => {
              this.updateToolboxBlockValue(`${prefix}x`, Math.round(this.props.vm.editingTarget.x).toString());
              this.updateToolboxBlockValue(`${prefix}y`, Math.round(this.props.vm.editingTarget.y).toString());
          });
      }
    }
    onWorkspaceMetricsChange () {
        const target = this.props.vm.editingTarget;
        if (target && target.id) {
            const workspaceMetrics = Object.assign({}, this.state.workspaceMetrics, {
                [target.id]: {
                    scrollX: this.workspace.scrollX,
                    scrollY: this.workspace.scrollY,
                    scale: this.workspace.scale
                }
            });
            this.setState({workspaceMetrics});
        }
    }
    onScriptGlowOn (data) {
        this.workspace.glowStack(data.id, true);
    }
    onScriptGlowOff (data) {
        this.workspace.glowStack(data.id, false);
    }
    onBlockGlowOn (data) {
        this.workspace.glowBlock(data.id, true);
    }
    onBlockGlowOff (data) {
        this.workspace.glowBlock(data.id, false);
    }
    onVisualReport (data) {
        this.workspace.reportValue(data.id, data.value);
    }
    getToolboxXML () {
        // Use try/catch because this requires digging pretty deep into the VM
        // Code inside intentionally ignores several error situations (no stage, etc.)
        // Because they would get caught by this try/catch
        try {
            let {editingTarget: target, runtime} = this.props.vm;
            const stage = runtime.getTargetForStage();
            if (!target) target = stage; // If no editingTarget, use the stage

            const stageCostumes = stage.getCostumes();
            const targetCostumes = target.getCostumes();
            const targetSounds = target.getSounds();
            const dynamicBlocksXML = this.props.vm.runtime.getBlocksXML();
            return makeToolboxXML(target.isStage, target.id, dynamicBlocksXML,
                targetCostumes[0].name,
                stageCostumes[0].name,
                targetSounds.length > 0 ? targetSounds[0].name : ''
            );
        } catch {
            return null;
        }
    }
    onWorkspaceUpdate (data) {

        // When we change sprites, update the toolbox to have the new sprite's blocks
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }

        if (this.props.vm.editingTarget && !this.state.workspaceMetrics[this.props.vm.editingTarget.id]) {
            this.onWorkspaceMetricsChange();
        }

        // Remove and reattach the workspace listener (but allow flyout events)
        this.workspace.removeChangeListener(this.props.vm.blockListener);
        const dom = this.ScratchBlocks.Xml.textToDom(data.xml);
        try {
            this.ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml(dom, this.workspace);
        } catch (error) {
            // The workspace is likely incomplete. What did update should be
            // functional.
            //
            // Instead of throwing the error, by logging it and continuing as
            // normal lets the other workspace update processes complete in the
            // gui and vm, which lets the vm run even if the workspace is
            // incomplete. Throwing the error would keep things like setting the
            // correct editing target from happening which can interfere with
            // some blocks and processes in the vm.
            if (error.message) {
                error.message = `Workspace Update Error: ${error.message}`;
            }
            log.error(error);
        }
        this.workspace.addChangeListener(this.props.vm.blockListener);

        if (this.props.vm.editingTarget && this.state.workspaceMetrics[this.props.vm.editingTarget.id]) {
            const {scrollX, scrollY, scale} = this.state.workspaceMetrics[this.props.vm.editingTarget.id];
            this.workspace.scrollX = scrollX;
            this.workspace.scrollY = scrollY;
            this.workspace.scale = scale;
            this.workspace.resize();
        }

        // Clear the undo state of the workspace since this is a
        // fresh workspace and we don't want any changes made to another sprites
        // workspace to be 'undone' here.
        this.workspace.clearUndo();
    }

    handleExtensionAdded (categoryInfo) {
        const defineBlocks = blockInfoArray => {
            if (blockInfoArray && blockInfoArray.length > 0) {
                const staticBlocksJson = [];
                const dynamicBlocksInfo = [];
                blockInfoArray.forEach(blockInfo => {
                    if (blockInfo.info && blockInfo.info.isDynamic) {
                        dynamicBlocksInfo.push(blockInfo);
                    } else if (blockInfo.json) {
                        staticBlocksJson.push(blockInfo.json);
                    }
                    // otherwise it's a non-block entry such as '---'
                });

                this.ScratchBlocks.defineBlocksWithJsonArray(staticBlocksJson);
                dynamicBlocksInfo.forEach(blockInfo => {
                    // This is creating the block factory / constructor -- NOT a specific instance of the block.
                    // The factory should only know static info about the block: the category info and the opcode.
                    // Anything else will be picked up from the XML attached to the block instance.
                    const extendedOpcode = `${categoryInfo.id}_${blockInfo.info.opcode}`;
                    const blockDefinition =
                        defineDynamicBlock(this.ScratchBlocks, categoryInfo, blockInfo, extendedOpcode);
                    this.ScratchBlocks.Blocks[extendedOpcode] = blockDefinition;
                });
            }
        };

        // scratch-blocks implements a menu or custom field as a special kind of block ("shadow" block)
        // these actually define blocks and MUST run regardless of the UI state
        defineBlocks(
            Object.getOwnPropertyNames(categoryInfo.customFieldTypes)
                .map(fieldTypeName => categoryInfo.customFieldTypes[fieldTypeName].scratchBlocksDefinition));
        defineBlocks(categoryInfo.menus);
        defineBlocks(categoryInfo.blocks);

        // Update the toolbox with new blocks if possible
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }
    }
    handleBlocksInfoUpdate (categoryInfo) {
        // @todo Later we should replace this to avoid all the warnings from redefining blocks.
        this.handleExtensionAdded(categoryInfo);
    }
    handleCategorySelected (categoryId) {
        const extension = extensionData.find(ext => ext.extensionId === categoryId);
        if (extension && extension.launchPeripheralConnectionFlow) {
            this.handleConnectionModalStart(categoryId);
        }

        this.withToolboxUpdates(() => {
            this.workspace.toolbox_.setSelectedCategoryById(categoryId);
        });
    }
    setBlocks (blocks) {
        this.blocks = blocks;
    }
    handlePromptStart (message, defaultValue, callback, optTitle, optVarType) {
        const p = {prompt: {callback, message, defaultValue}};
        p.prompt.title = optTitle ? optTitle :
            this.ScratchBlocks.Msg.VARIABLE_MODAL_TITLE;
        p.prompt.varType = typeof optVarType === 'string' ?
            optVarType : this.ScratchBlocks.SCALAR_VARIABLE_TYPE;
        p.prompt.showVariableOptions = // This flag means that we should show variable/list options about scope
            optVarType !== this.ScratchBlocks.BROADCAST_MESSAGE_VARIABLE_TYPE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_VARIABLE_MODAL_TITLE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_LIST_MODAL_TITLE;
        p.prompt.showCloudOption = (optVarType === this.ScratchBlocks.SCALAR_VARIABLE_TYPE) && this.props.canUseCloud;
        this.setState(p);
    }
    handleConnectionModalStart (extensionId) {
        this.props.onOpenConnectionModal(extensionId);
    }
    handleStatusButtonUpdate () {
        this.ScratchBlocks.refreshStatusButtons(this.workspace);
    }
    handleOpenSoundRecorder () {
        this.props.onOpenSoundRecorder();
    }

    /*
     * Pass along information about proposed name and variable options (scope and isCloud)
     * and additional potentially conflicting variable names from the VM
     * to the variable validation prompt callback used in scratch-blocks.
     */
    handlePromptCallback (input, variableOptions) {
        this.state.prompt.callback(
            input,
            this.props.vm.runtime.getAllVarNamesOfType(this.state.prompt.varType),
            variableOptions);
        this.handlePromptClose();
    }
    handlePromptClose () {
        this.setState({prompt: null});
    }
    handleCustomProceduresClose (data) {
        this.props.onRequestCloseCustomProcedures(data);
        const ws = this.workspace;
        ws.refreshToolboxSelection_();
        ws.toolbox_.scrollToCategoryById('myBlocks');
    }
    handleDrop (dragInfo) {
        fetch(dragInfo.payload.bodyUrl)
            .then(response => response.json())
            .then(blocks => this.props.vm.shareBlocksToTarget(blocks, this.props.vm.editingTarget.id))
            .then(() => {
                this.props.vm.refreshWorkspace();
                this.updateToolbox(); // To show new variables/custom blocks
            });
    }
    render () {
        /* eslint-disable no-unused-vars */
        const {
            anyModalVisible,
            canUseCloud,
            customProceduresVisible,
            extensionLibraryVisible,
            options,
            stageSize,
            vm,
            isRtl,
            isVisible,
            onActivateColorPicker,
            onOpenConnectionModal,
            onOpenSoundRecorder,
            updateToolboxState,
            onActivateCustomProcedures,
            onRequestCloseExtensionLibrary,
            onRequestCloseCustomProcedures,
            toolboxXML,
            ...props
        } = this.props;
        /* eslint-enable no-unused-vars */
        return (
            <React.Fragment>
                <DroppableBlocks
                    componentRef={this.setBlocks}
                    onDrop={this.handleDrop}
                    {...props}
                />
                {this.state.prompt ? (
                    <Prompt
                        defaultValue={this.state.prompt.defaultValue}
                        isStage={vm.runtime.getEditingTarget().isStage}
                        label={this.state.prompt.message}
                        showCloudOption={this.state.prompt.showCloudOption}
                        showVariableOptions={this.state.prompt.showVariableOptions}
                        title={this.state.prompt.title}
                        vm={vm}
                        onCancel={this.handlePromptClose}
                        onOk={this.handlePromptCallback}
                    />
                ) : null}
                {extensionLibraryVisible ? (
                    <ExtensionLibrary
                        vm={vm}
                        onCategorySelected={this.handleCategorySelected}
                        onRequestClose={onRequestCloseExtensionLibrary}
                    />
                ) : null}
                {customProceduresVisible ? (
                    <CustomProcedures
                        options={{
                            media: options.media
                        }}
                        onRequestClose={this.handleCustomProceduresClose}
                    />
                ) : null}
            </React.Fragment>
        );
    }
}

Blocks.propTypes = {
    anyModalVisible: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    customProceduresVisible: PropTypes.bool,
    extensionLibraryVisible: PropTypes.bool,
    isRtl: PropTypes.bool,
    isVisible: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    messages: PropTypes.objectOf(PropTypes.string),
    onActivateColorPicker: PropTypes.func,
    onActivateCustomProcedures: PropTypes.func,
    onOpenConnectionModal: PropTypes.func,
    onOpenSoundRecorder: PropTypes.func,
    onRequestCloseCustomProcedures: PropTypes.func,
    onRequestCloseExtensionLibrary: PropTypes.func,
    options: PropTypes.shape({
        media: PropTypes.string,
        zoom: PropTypes.shape({
            controls: PropTypes.bool,
            wheel: PropTypes.bool,
            startScale: PropTypes.number
        }),
        colours: PropTypes.shape({
            workspace: PropTypes.string,
            flyout: PropTypes.string,
            toolbox: PropTypes.string,
            toolboxSelected: PropTypes.string,
            scrollbar: PropTypes.string,
            scrollbarHover: PropTypes.string,
            insertionMarker: PropTypes.string,
            insertionMarkerOpacity: PropTypes.number,
            fieldShadow: PropTypes.string,
            dragShadowOpacity: PropTypes.number
        }),
        comments: PropTypes.bool,
        collapse: PropTypes.bool
    }),
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    toolboxXML: PropTypes.string,
    updateToolboxState: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

Blocks.defaultOptions = {
    zoom: {
        controls: true,
        wheel: true,
        startScale: 0.675
    },
    grid: {
        spacing: 40,
        length: 2,
        colour: '#ddd'
    },
    colours: {
        workspace: '#F9F9F9',
        flyout: '#F9F9F9',
        toolbox: '#FFFFFF',
        toolboxSelected: '#E9EEF2',
        scrollbar: '#CECDCE',
        scrollbarHover: '#CECDCE',
        insertionMarker: '#000000',
        insertionMarkerOpacity: 0.2,
        fieldShadow: 'rgba(255, 255, 255, 0.3)',
        dragShadowOpacity: 0.6
    },
    comments: true,
    collapse: false,
    sounds: false
};

Blocks.defaultProps = {
    isVisible: true,
    options: Blocks.defaultOptions
};

const mapStateToProps = state => ({
    anyModalVisible: (
        Object.keys(state.scratchGui.modals).some(key => state.scratchGui.modals[key]) ||
        state.scratchGui.mode.isFullScreen
    ),
    extensionLibraryVisible: state.scratchGui.modals.extensionLibrary,
    isRtl: state.locales.isRtl,
    locale: state.locales.locale,
    messages: state.locales.messages,
    toolboxXML: state.scratchGui.toolbox.toolboxXML,
    customProceduresVisible: state.scratchGui.customProcedures.active
});

const mapDispatchToProps = dispatch => ({
    onActivateColorPicker: callback => dispatch(activateColorPicker(callback)),
    onActivateCustomProcedures: (data, callback) => dispatch(activateCustomProcedures(data, callback)),
    onOpenConnectionModal: id => {
        dispatch(setConnectionModalExtensionId(id));
        dispatch(openConnectionModal());
    },
    onOpenSoundRecorder: () => {
        dispatch(activateTab(SOUNDS_TAB_INDEX));
        dispatch(openSoundRecorder());
    },
    onRequestCloseExtensionLibrary: () => {
        dispatch(closeExtensionLibrary());
    },
    onRequestCloseCustomProcedures: data => {
        dispatch(deactivateCustomProcedures(data));
    },
    updateToolboxState: toolboxXML => {
        dispatch(updateToolbox(toolboxXML));
    }
});

export default errorBoundaryHOC('Blocks')(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(Blocks)
);
