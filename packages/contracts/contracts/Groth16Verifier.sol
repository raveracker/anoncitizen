// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 14226165386143948040295344993924868566983702884191766395342987235848527101743;
    uint256 constant deltax2 = 3863772906261741216421200386635376133587832931235641931984599047785106108229;
    uint256 constant deltay1 = 17113428918309666624493350158299483461690357302099816809858290153463234342286;
    uint256 constant deltay2 = 16157572416966345412201877345384552166442516026900676490958382546179420047715;

    
    uint256 constant IC0x = 6259615773628986582966346057723612429962057300826514275161844011177785037250;
    uint256 constant IC0y = 17644625533119658552868594212467531632303332474065490810242239067663732809605;
    
    uint256 constant IC1x = 7415040617193587950155019123162965046102583091869924148759488208051522951771;
    uint256 constant IC1y = 10088886974459371725652800068350637160339478917169449328801232260077841704951;
    
    uint256 constant IC2x = 3866850323107988059201300087534200926777987696530550399056798116664746685631;
    uint256 constant IC2y = 12814950521494100751297534750776795443921772225938628185999259478560334873037;
    
    uint256 constant IC3x = 16914537730344690615772837787816007396544204230977388813126609235329756618702;
    uint256 constant IC3y = 11835654825095187504655273877190199194047185970048153107173358673064980595921;
    
    uint256 constant IC4x = 10041764239410859962563614753735965576699845314170134005503192639612215590417;
    uint256 constant IC4y = 311328669774599846185239241617560386275677782740921781428358883577570146992;
    
    uint256 constant IC5x = 3929994726180332793086109780395272622512630234769253789332744255359586727754;
    uint256 constant IC5y = 15856804479030081756903715229586670595325185393852486254087533200886469351071;
    
    uint256 constant IC6x = 16120269110150027064615324530564054059762157439722809073871313104058929715212;
    uint256 constant IC6y = 20863335890460055168583164767797528579525714682135268061268268750846404611104;
    
    uint256 constant IC7x = 18579658885927914148190333636142673138047941228777827237196456034193033901370;
    uint256 constant IC7y = 17949226919667686317802927252956453815115990303712571976331437243665152230501;
    
    uint256 constant IC8x = 14073155383894808629333269099181000481883925461861604738045227098016120352022;
    uint256 constant IC8y = 4154725089795481789689486981524692505657232281067307660708177297693544009412;
    
    uint256 constant IC9x = 5057340561918995710199640036510444732925739986321533023755751372288801864385;
    uint256 constant IC9y = 3009096992563599297086911071334415814068335570441919478452724873191924825923;
    
    uint256 constant IC10x = 9699528246710473717914993048259147203922461540342019716026228284882950608271;
    uint256 constant IC10y = 1063130768648922852134496444184801667905271636086624484667951890722167241974;
    
    uint256 constant IC11x = 7804172773080715965034758197247740261356146705454781058936899688075776025578;
    uint256 constant IC11y = 5412623202931527560429175143700940628086384569732202939241942874195218654593;
    
    uint256 constant IC12x = 1083662319841119397177761117339453521156230855636543247568402901309034991083;
    uint256 constant IC12y = 8353659903856565396244512088960448382522742098829842459421735813967553336175;
    
    uint256 constant IC13x = 15193183049296325050651511123804446086189805395871105420591347964212054715255;
    uint256 constant IC13y = 13399692824910952134877433247169426676505135540775051338604927550678971727868;
    
    uint256 constant IC14x = 16936819983727371025180309750104492015285442048711220375910296433312885590646;
    uint256 constant IC14y = 9125221433168515911610526483016750805876013098011543876446063175377914479154;
    
    uint256 constant IC15x = 10823305160086188811823896564261491791307552143093262723998755358495634168096;
    uint256 constant IC15y = 3462023014168708928064776119130222080984065595946786319438585648301507274640;
    
    uint256 constant IC16x = 11669106545223827920734960249414033085046041782268323066223141834401098267695;
    uint256 constant IC16y = 12668799196222691409886886988634452711983712356501317996019876257243585571765;
    
    uint256 constant IC17x = 21162926350671655127893933939457439954452570811680211391735086894230409700114;
    uint256 constant IC17y = 4166582580690081295407889102745194682075559190125788753716378724654791696480;
    
    uint256 constant IC18x = 20576679524148141530899300312810568199373292418752851001069753681696941630433;
    uint256 constant IC18y = 12198205311446877755359659348490157944831046860990010818212588363978392486375;
    
    uint256 constant IC19x = 16423441166103279775356866942096475013055053571909567941584422293147914482055;
    uint256 constant IC19y = 9352199841179111307250388827263862375785081538893632536920205449027531113172;
    
    uint256 constant IC20x = 14323235307022113592182168134421175900436862576061109975244798354317387237455;
    uint256 constant IC20y = 322966658882511768969025109753762292113362526686521201839021581637055057087;
    
    uint256 constant IC21x = 4514569679646646903125319716670955613925518632200110579507851266225758859810;
    uint256 constant IC21y = 20573357386593012250121037715732389127668014499808932487515070302891072109789;
    
    uint256 constant IC22x = 21582891181213328788414666123837356257275491674348167498896390745955553174127;
    uint256 constant IC22y = 12120256681988524047960376862357691803930613567888041901371142645229928008500;
    
    uint256 constant IC23x = 15376177062340872283336498169911056263923974196123836236208608983077778588962;
    uint256 constant IC23y = 20346345736815466584400908418913678796873261822217747785814128834165919124177;
    
    uint256 constant IC24x = 7467124921983634637329081952153216580961468723851877980230263397506715167386;
    uint256 constant IC24y = 10787701363442862329151934363395418875455976582058236632723754152442458067702;
    
    uint256 constant IC25x = 8078918360718737186152802045223594732083183878895963181100572924161682070230;
    uint256 constant IC25y = 16875765883867225771772986206351221801105760357227824394581744638802766796908;
    
    uint256 constant IC26x = 1135951054209440913955281144129824088858446343272810854091674231004328122655;
    uint256 constant IC26y = 16320027513688005573942655590016265085625571834095736268745126027107555296894;
    
    uint256 constant IC27x = 1333331120070100259340425622986958992750369807326182233829167978975876517646;
    uint256 constant IC27y = 330660876126947124651218214294720755188506139278814150479995014840402539426;
    
    uint256 constant IC28x = 5429198711687885748577368197533730321564700626120307317524727557668395895048;
    uint256 constant IC28y = 20283768883861137011498039182548897764915502199172239581726679292282674328018;
    
    uint256 constant IC29x = 17721832204771378394996443267869785510672890395804804746629827156815615347180;
    uint256 constant IC29y = 5965878541539624615345532432540182816413539462311773729836230054085219711073;
    
    uint256 constant IC30x = 2401306774960788331934840343891577058735350337597148310023450720712998476046;
    uint256 constant IC30y = 20077769484389102568271628147519486732323725733423155647439649549105312408067;
    
    uint256 constant IC31x = 15693246752210901543470213421430146562580609874467173063732475730711388362415;
    uint256 constant IC31y = 13626907936561358135557384170248458620104917868161793019844289293557107053558;
    
    uint256 constant IC32x = 4504687527191240592464271913134627960924774836437045347071995070943348304513;
    uint256 constant IC32y = 21675005625638237998897866688486348089233856079932917416027243822983219725429;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[32] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                
                g1_mulAccC(_pVk, IC27x, IC27y, calldataload(add(pubSignals, 832)))
                
                g1_mulAccC(_pVk, IC28x, IC28y, calldataload(add(pubSignals, 864)))
                
                g1_mulAccC(_pVk, IC29x, IC29y, calldataload(add(pubSignals, 896)))
                
                g1_mulAccC(_pVk, IC30x, IC30y, calldataload(add(pubSignals, 928)))
                
                g1_mulAccC(_pVk, IC31x, IC31y, calldataload(add(pubSignals, 960)))
                
                g1_mulAccC(_pVk, IC32x, IC32y, calldataload(add(pubSignals, 992)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            
            checkField(calldataload(add(_pubSignals, 832)))
            
            checkField(calldataload(add(_pubSignals, 864)))
            
            checkField(calldataload(add(_pubSignals, 896)))
            
            checkField(calldataload(add(_pubSignals, 928)))
            
            checkField(calldataload(add(_pubSignals, 960)))
            
            checkField(calldataload(add(_pubSignals, 992)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
